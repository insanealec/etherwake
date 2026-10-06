import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, sin, cos, dot, length, normalize, cross, max, pow, smoothstep, mix, select,
	positionGeometry, attribute, round, cameraPosition, frontFacing, varyingProperty, fog, densityFogFactor,
	mx_fractal_noise_float, mx_noise_float, If, Discard, screenCoordinate, fract
} from 'three/tsl';
import { SEA, WAVES } from './Waves.js';
import { HARBOR, REGIONS } from '../world/WorldLayout.js';
import { FLARES, FLARE_TINT } from '../game/Flares.js';
import { RIM } from '../game/Rim.js';

// Harbour calm: swells shrink to HARBOR.calm near the port. Shared by the JS and TSL wave functions.
const uHarbor = uniform( new THREE.Vector4( HARBOR.x, HARBOR.z, HARBOR.calmRadius, HARBOR.fadeRadius ) );
function harborCalm( x, z ) {

	const d = Math.hypot( x - HARBOR.x, z - HARBOR.z );
	const t = Math.max( 0, Math.min( 1, ( d - HARBOR.calmRadius ) / ( HARBOR.fadeRadius - HARBOR.calmRadius ) ) );
	return HARBOR.calm + ( 1 - HARBOR.calm ) * t * t * ( 3 - 2 * t );

}

// Leviathan bow waves (milestone 6): moving swell sources set each frame by world/Leviathans.js via
// setBowWave(). Each is a smooth mound over and ahead of a whale's head plus a V-shaped wake trailing
// back from the bow, all scaled by the whale's length. Shared by the JS and TSL wave functions.
export const BOW = {
	count: 3,
	moundAhead: 0.35, // mound centre ahead of the body centre (body lengths)
	moundLength: 0.28, // mound size along and across travel (body lengths)
	moundWidth: 0.5,
	moundHeight: 0.1,
	bowAt: 0.45, // where the wake arms start (ahead of the body centre)
	armSpread: 0.35, // tan of the wake half-angle (~19.5 degrees)
	armWidth: 0.1, // arm width at the bow (body lengths), growing 0.04 m per metre back
	armHeight: 0.06,
	armDecay: 3 // arms fade over this many body lengths
};
const bowJS = Array.from( { length: BOW.count }, () => ( { x: 0, z: 0, dx: 1, dz: 0, L: 1, s: 0 } ) );
const uBow = Array.from( { length: BOW.count }, () => ( { a: uniform( new THREE.Vector4( 0, 0, 1, 0 ) ), b: uniform( new THREE.Vector4( 1, 0, 0, 0 ) ) } ) );

export function setBowWave( i, x, z, dx, dz, length, strength ) {

	Object.assign( bowJS[ i ], { x, z, dx, dz, L: length, s: strength } );
	uBow[ i ].a.value.set( x, z, dx, dz );
	uBow[ i ].b.value.set( length, strength, 0, 0 );

}

// how high the bow waves lift the surface at (x, z), e.g. to tell if the surfer is riding one
export const bowHeightAt = ( x, z ) => bowHeightJS( x, z );

function bowHeightJS( x, z ) {

	let h = 0;
	for ( const w of bowJS ) {

		if ( w.s <= 0 ) continue;
		const L = w.L, lx = x - w.x, lz = z - w.z;
		const u = lx * w.dx + lz * w.dz, v = - lx * w.dz + lz * w.dx;
		const mu = ( u - BOW.moundAhead * L ) / ( BOW.moundLength * L ), mv = v / ( BOW.moundWidth * L );
		const mound = Math.exp( - mu * mu - mv * mv ) * BOW.moundHeight * L;
		const s = BOW.bowAt * L - u;
		if ( s > 0 ) {

			const q = ( Math.abs( v ) - BOW.armSpread * s ) / ( BOW.armWidth * L + 0.04 * s );
			const k = Math.min( 1, s / ( 0.4 * L ) );
			h += Math.exp( - q * q - s / ( BOW.armDecay * L ) ) * k * k * ( 3 - 2 * k ) * BOW.armHeight * L * w.s;

		}
		h += mound * w.s;

	}
	return h;

}

// TSL twin of bowHeightJS at grid point p (vec2)
function bowHeight( p ) {

	let h = float( 0 );
	for ( const { a, b } of uBow ) {

		const L = b.x, st = b.y;
		const l = p.sub( a.xy );
		const u = l.x.mul( a.z ).add( l.y.mul( a.w ) ), v = l.y.mul( a.z ).sub( l.x.mul( a.w ) );
		const mu = u.sub( L.mul( BOW.moundAhead ) ).div( L.mul( BOW.moundLength ) ), mv = v.div( L.mul( BOW.moundWidth ) );
		const mound = mu.mul( mu ).add( mv.mul( mv ) ).negate().exp().mul( L.mul( BOW.moundHeight ) );
		const s = L.mul( BOW.bowAt ).sub( u ).max( 0 ); // distance behind the bow (arms only exist behind it)
		const q = v.abs().sub( s.mul( BOW.armSpread ) ).div( L.mul( BOW.armWidth ).add( s.mul( 0.04 ) ) );
		const arms = q.mul( q ).add( s.div( L.mul( BOW.armDecay ) ) ).negate().exp().mul( smoothstep( 0, L.mul( 0.4 ), s ) ).mul( L.mul( BOW.armHeight ) );
		h = h.add( mound.add( arms ).mul( st ) );

	}
	return h;

}

// Flare-fronts (milestone 8): up to FRONTS solitary waves (sech² ridges) rolling across a region along
// `dir`, faded out toward the region's edge; inside the region the ordinary swell is also taller
// (`swell` multiplier). setFlareRegion() once; setFlare( i, s, H ) each frame per front (s: its distance
// along dir from the region centre; H: its current height, 0 when there's none).
export const FRONTS = 3;
const flareJS = { cx: 0, cz: 0, dx: 1, dz: 0, R: 1, swell: 1, s: [ 0, 0, 0 ], H: [ 0, 0, 0 ] };
const uFlareA = uniform( new THREE.Vector4( 0, 0, 1, 0 ) ); // cx, cz, dx, dz
const uFlareB = uniform( new THREE.Vector4( FLARES.width, 1, 1, 0 ) ); // width, R, swell
const uFlareS = uniform( new THREE.Vector4() ); // front positions
const uFlareH = uniform( new THREE.Vector4() ); // front heights

export function setFlareRegion( cx, cz, dx, dz, R, swell = 1 ) {

	Object.assign( flareJS, { cx, cz, dx, dz, R, swell } );
	uFlareA.value.set( cx, cz, dx, dz );
	uFlareB.value.y = R;
	uFlareB.value.z = swell;

}

export function setFlare( i, s, H ) {

	flareJS.s[ i ] = s;
	flareJS.H[ i ] = H;
	uFlareS.value.setComponent( i, s );
	uFlareH.value.setComponent( i, H );

}

const smoothJS = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

function flareHeightJS( x, z ) {

	const f = flareJS;
	const lx = x - f.cx, lz = z - f.cz, r = Math.hypot( lx, lz );
	if ( r >= f.R ) return 0;
	const u = lx * f.dx + lz * f.dz, fade = smoothJS( f.R, f.R * 0.7, r );
	let h = 0;
	for ( let i = 0; i < FRONTS; i ++ ) {

		if ( f.H[ i ] <= 0 ) continue;
		const e = Math.exp( - 2 * Math.abs( u - f.s[ i ] ) / FLARES.width );
		h += f.H[ i ] * 4 * e / ( ( 1 + e ) * ( 1 + e ) );

	}
	return h * fade;

}

// the region's swell multiplier at (x, z): 1 outside, `swell` well inside
function swellFactorJS( x, z ) {

	const f = flareJS;
	return 1 + ( f.swell - 1 ) * smoothJS( f.R * 1.1, f.R * 0.6, Math.hypot( x - f.cx, z - f.cz ) );

}

function swellFactor( p ) {

	return uFlareB.z.sub( 1 ).mul( smoothstep( uFlareB.y.mul( 1.1 ), uFlareB.y.mul( 0.6 ), length( p.sub( uFlareA.xy ) ) ) ).add( 1 );

}

// how high the flare-front lifts the surface at (x, z)
export const flareHeightAt = ( x, z ) => flareHeightJS( x, z );

// TSL twin of flareHeightJS at point p (vec2)
function flareHeight( p ) {

	const l = p.sub( uFlareA.xy );
	const u = dot( l, uFlareA.zw );
	let h = float( 0 );
	for ( const c of [ 'x', 'y', 'z' ] ) {

		const e = u.sub( uFlareS[ c ] ).abs().div( uFlareB.x ).mul( - 2 ).exp();
		h = h.add( uFlareH[ c ].mul( e.mul( 4 ).div( e.add( 1 ).mul( e.add( 1 ) ) ) ) );

	}
	return h.mul( smoothstep( uFlareB.y, uFlareB.y.mul( 0.7 ), length( l ) ) );

}

// everything that lifts the sea on top of the swell: leviathan bow waves and flare-fronts
// The Rim's infalling ring waves (milestone 8): concentric swells rolling in toward the centre, fading
// out near the core and toward the region's edge. Shared by JS and TSL.
const RK = 2 * Math.PI / RIM.ringLength, RW = RK * RIM.ringSpeed, RC = REGIONS.rim;
function ringHeightJS( x, z, t ) {

	const r = Math.hypot( x - RC.x, z - RC.z );
	if ( r > RC.radius ) return 0;
	const s = ( a, b, v ) => {

		const k = Math.max( 0, Math.min( 1, ( v - a ) / ( b - a ) ) );
		return k * k * ( 3 - 2 * k );

	};
	return RIM.ringAmp * Math.sin( RK * r + RW * t ) * s( RIM.inner, RIM.inner + 200, r ) * s( RC.radius, RC.radius * 0.7, r );

}

function ringHeight( p, t ) {

	const r = length( p.sub( vec2( RC.x, RC.z ) ) );
	return sin( r.mul( RK ).add( t.mul( RW ) ) ).mul( RIM.ringAmp )
		.mul( smoothstep( RIM.inner, RIM.inner + 200, r ) ).mul( smoothstep( RC.radius, RC.radius * 0.7, r ) );

}

// how high the Rim's ring waves lift the surface at (x, z, t)
export const ringHeightAt = ( x, z, t ) => ringHeightJS( x, z, t );

// everything that lifts the sea on top of the swell: leviathan bow waves, flare-fronts, ring waves
const extraHeight = ( p, t ) => bowHeight( p ).add( flareHeight( p ) ).add( ringHeight( p, t ) );
const extraHeightJS = ( x, z, t ) => bowHeightJS( x, z ) + flareHeightJS( x, z ) + ringHeightJS( x, z, t );

const TAU = Math.PI * 2;

// Grid: a plane of HALF metres half-extent, remapped so vertices are dense near
// the centre (~0.6 m) and sparse at the edge. It follows the camera, snapped to
// the centre spacing. Later upgrade: clipmap LOD.
const HALF = 2500;
const SEGMENTS = 512;
const CENTER = 0.06;
const SNAP = HALF * CENTER * 2 / SEGMENTS;

// Linear-space colours (they brighten and desaturate after sRGB output, so keep them saturated).
export const PALETTE = {
	troughA: new THREE.Color( 0.00, 0.14, 0.20 ), // teal
	troughB: new THREE.Color( 0.08, 0.015, 0.24 ), // violet
	crestA: new THREE.Color( 1.00, 0.32, 0.03 ), // gold
	crestB: new THREE.Color( 1.00, 0.10, 0.16 ), // rose
	foam: new THREE.Color( 1.00, 0.70, 0.42 ),
	cloudLitA: new THREE.Color( 0.10, 0.22, 0.68 ), // sunlit billows: blue-violet
	cloudLitB: new THREE.Color( 0.30, 0.15, 0.58 ), // and lavender
	cloudShadeA: new THREE.Color( 0.01, 0.025, 0.14 ), // creases: deep blue
	cloudShadeB: new THREE.Color( 0.05, 0.012, 0.13 ), // and indigo
	rim: new THREE.Color( 0.30, 0.10, 0.55 ),
	sun: new THREE.Color( 1.00, 0.60, 0.30 ),
	underside: new THREE.Color( 0.08, 0.015, 0.16 ),
	fogAbove: new THREE.Color( 0.10, 0.02, 0.09 ),
	fogBelow: new THREE.Color( 0.04, 0.008, 0.10 )
};

export const FOG = { above: 0.0011, below: 0.03 };

// Cloud tops: the swell is covered in rounded billows (billow noise, two sizes),
// lit by the sun like cumulus: bright sun-facing tops, violet shade in the creases. Visual only (physics
// rides the smooth swell, so the board sinks a little into the billows). See billow() and cloudColor().
export const CLOUD = {
	big: { cell: 9, amp: 1.8 }, // metres: billow size and height (also lifts the mesh near the camera)
	fine: { cell: 3, amp: 0.5 }, // per-pixel lumps on the billows
	drift: [ 0.9, 0.25 ], // m/s
	wrap: 0.2, // diffuse wrap: how far light creeps round the billows
	glow: 0.5, // how much the crest colours glow from within
	clear: 0.45, // opacity of the thinnest gas near you (the creases); the lump tops are denser
	clearNear: 25, clearFar: 220, // see-through near the camera, fully dense by clearFar
	deep: 9 // metres: a dimmer cloud layer below, seen through the top one
};
// billow noise: |noise| has rounded tops and creased valleys, like the lumps on a cumulus
const lumps = ( q, t, seed ) => mx_noise_float( vec3( q, t.mul( 0.04 ).add( seed ) ) ).abs().mul( 1.6 ).clamp();

// TSL: billow height (metres) and crease occlusion at xz. fine: 0..1 weight of the small octave.
export function billow( xz, t, fine ) {

	const q = xz.sub( vec2( ...CLOUD.drift ).mul( t ) );
	const d1 = lumps( q.div( CLOUD.big.cell ), t, 0 );
	const d2 = lumps( q.div( CLOUD.fine.cell ), t, 5.3 );
	return {
		h: d1.mul( CLOUD.big.amp ).add( d2.mul( CLOUD.fine.amp ).mul( fine ) ),
		occ: mix( float( 0.3 ), float( 1 ), d1.sqrt().mul( mix( float( 1 ), d2.sqrt().mul( 0.4 ).add( 0.6 ), fine ) ) )
	};

}

// TSL: cumulus-style shading in the nebula palette (shared by the sea and the cloud puffs).
// N, L, V: normal, sun and view directions; crest, tint: 0..1; occ: crease darkening; c: palette lookup
export function cloudColor( N, L, V, crest, tint, occ, c ) {

	const diffuse = dot( N, L ).add( CLOUD.wrap ).div( 1 + CLOUD.wrap ).clamp();
	const sky = N.y.mul( 0.5 ).add( 0.5 ); // light from the glowing sky above
	const shade = mix( c( 'cloudShadeA' ), c( 'cloudShadeB' ), tint );
	const lit = mix( c( 'cloudLitA' ), c( 'cloudLitB' ), tint );
	const hot = mix( c( 'crestA' ), c( 'crestB' ), tint.oneMinus() );
	const col = mix( shade, lit, diffuse.mul( 0.8 ).add( sky.mul( 0.2 ) ) ).mul( occ ).toVar();
	col.addAssign( hot.mul( crest.mul( crest ) ).mul( CLOUD.glow ).mul( diffuse.mul( 0.6 ).add( 0.4 ) ) );
	// silver lining: thin edges glow when the sun is behind them
	const edge = pow( max( dot( N, V ), 0 ).oneMinus(), 3 );
	col.addAssign( c( 'sun' ).mul( pow( max( dot( V.negate(), L ), 0 ), 4 ) ).mul( edge ).mul( 1.2 ) );
	return col;

}

// Precomputed per-wave constants from the WAVES table (shared by JS and TSL).
function waveConstants() {

	return WAVES.map( ( w ) => {

		const k = TAU / w.wavelength;
		const a = w.angle * Math.PI / 180;
		return {
			dx: Math.cos( a ), dz: Math.sin( a ), k,
			s: w.steepness * SEA.steepness,
			omega: Math.sqrt( SEA.gravity * k ) * w.speed,
			fadeStart: w.wavelength * SEA.fadeStart,
			fadeEnd: w.wavelength * SEA.fadeEnd
		};

	} );

}

// TSL: sum of Gerstner waves at world grid point p (vec2 xz). Must be called inside a Fn.
// `waves` is the array of { a: vec4( dx, dz, k, s ), b: vec4( omega, fadeStart, fadeEnd, 0 ) } uniforms.
// Returns displacement plus the surface tangent/binormal for normals and the Jacobian.
export function etheriumWaves( p, waves, time, height, fadeFrom ) {

	const dist = length( p.sub( fadeFrom ) );
	const calm = mix( float( HARBOR.calm ), float( 1 ), smoothstep( uHarbor.z, uHarbor.w, length( p.sub( uHarbor.xy ) ) ) );
	const hs = height.mul( swellFactor( p ) ); // taller swell inside the Flare Reach
	const disp = vec3( 0 ).toVar();
	const tan = vec3( 1, 0, 0 ).toVar();
	const bin = vec3( 0, 0, 1 ).toVar();

	for ( const { a, b } of waves ) {

		const dx = a.x, dz = a.y, k = a.z;
		const s = a.w.mul( smoothstep( b.y, b.z, dist ).oneMinus() ).mul( calm );
		const f = k.mul( dot( a.xy, p ) ).sub( b.x.mul( time ) );
		const c = cos( f ), sn = sin( f );
		const amp = s.div( k );
		const ss = s.mul( sn ), sc = s.mul( c ).mul( hs );

		disp.addAssign( vec3( dx.mul( amp ).mul( c ), amp.mul( sn ).mul( hs ), dz.mul( amp ).mul( c ) ) );
		tan.addAssign( vec3( dx.mul( dx ).mul( ss ).negate(), dx.mul( sc ), dx.mul( dz ).mul( ss ).negate() ) );
		bin.addAssign( vec3( dx.mul( dz ).mul( ss ).negate(), dz.mul( sc ), dz.mul( dz ).mul( ss ).negate() ) );

	}

	// leviathan bow waves: height plus a finite-difference slope for the normal
	const bh = extraHeight( p, time ).toVar();
	const e = 0.6;
	disp.y.addAssign( bh.mul( height ) );
	tan.y.addAssign( extraHeight( p.add( vec2( e, 0 ) ), time ).sub( bh ).div( e ).mul( height ) );
	bin.y.addAssign( extraHeight( p.add( vec2( 0, e ) ), time ).sub( bh ).div( e ).mul( height ) );

	return { disp, tan, bin, jacobian: tan.x.mul( bin.z ).sub( tan.z.mul( bin.x ) ) };

}

// The etherium sea: a glowing cloud-surface of Gerstner swells.
// JS side: heightAt / normalAt for physics. TSL side: etheriumWaves for rendering.
export class Etherium {

	constructor( scene ) {

		this.scene = scene;
		this.time = 0;
		this.underwater = false;

		this.uTime = uniform( 0 );
		this.uHeight = uniform( SEA.height );
		this.uMaxAmp = uniform( 1 );
		this.uOffset = uniform( new THREE.Vector2() );
		this.uSunDir = uniform( new THREE.Vector3( - 0.6, 0.25, - 0.75 ).normalize() );
		this.uFogColor = uniform( PALETTE.fogAbove.clone() );
		this.uFogDensity = uniform( FOG.above );
		this.uUnderwater = uniform( 0 );
		this.uFlareMix = uniform( 0 ); // region atmosphere: 0 in the open sea, 1 inside a region
		this.uVolumeRange = uniform( 0 ); // > 0 when the volumetric etherium owns the near sea (useVolume)
		this.uRegionSea = uniform( new THREE.Color( ...FLARE_TINT.sea ) ); // the region's sea tint
		this.uRegionRecolor = uniform( 0 ); // 0: multiply the sea's colours; 1: repaint them in the tint (keeping brightness)
		this.regionMix = 0;
		this.regionFog = new THREE.Color( ...FLARE_TINT.fog ); // set by world/Regions.js
		this.uWaves = WAVES.map( () => ( { a: uniform( new THREE.Vector4() ), b: uniform( new THREE.Vector4() ) } ) );
		this.refresh();

		scene.fogNode = fog( this.uFogColor, densityFogFactor( this.uFogDensity ) );

		this.mesh = new THREE.Mesh( this.buildGeometry(), this.buildMaterial() );
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = - 1; // before the other see-through things (the puffs fade against its depth)
		scene.add( this.mesh );

		// the deeper cloud layer, seen through the top one (a child, so it follows the grid)
		this.deep = new THREE.Mesh( this.buildGeometry( 256 ), this.buildDeepMaterial() );
		this.deep.frustumCulled = false;
		this.mesh.add( this.deep );

	}

	// Re-read SEA / WAVES into the JS constants and the shader uniforms (call after tweaking).
	refresh() {

		this.waves = waveConstants();
		let maxAmp = 0;
		this.waves.forEach( ( w, i ) => {

			this.uWaves[ i ].a.value.set( w.dx, w.dz, w.k, w.s );
			this.uWaves[ i ].b.value.set( w.omega, w.fadeStart, w.fadeEnd, 0 );
			maxAmp += w.s / w.k;

		} );
		this.uHeight.value = SEA.height;
		this.uMaxAmp.value = maxAmp * SEA.height;

	}

	// segments: grid resolution (the gas shells use a coarser grid)
	buildGeometry( segments = SEGMENTS ) {

		const geo = new THREE.PlaneGeometry( 2, 2, segments, segments );
		geo.rotateX( - Math.PI / 2 );
		const pos = geo.attributes.position;
		const remap = ( u ) => HALF * u * ( CENTER + ( 1 - CENTER ) * u * u );
		// local vertex spacing rounded down to SNAP * 2^n: the shader snaps each vertex to this
		// world-fixed lattice, so waves don't swim across the sparse outer grid as it follows the camera
		const step = ( u ) => {

			const ds = HALF * ( CENTER + 3 * ( 1 - CENTER ) * u * u ) * 2 / segments;
			return SNAP * Math.pow( 2, Math.max( 0, Math.floor( Math.log2( ds / SNAP ) + 1e-6 ) ) );

		};
		const steps = new Float32Array( pos.count * 2 );
		for ( let i = 0; i < pos.count; i ++ ) {

			const u = pos.getX( i ), v = pos.getZ( i );
			pos.setX( i, remap( u ) );
			pos.setZ( i, remap( v ) );
			steps[ i * 2 ] = step( u );
			steps[ i * 2 + 1 ] = step( v );

		}
		geo.setAttribute( 'snapStep', new THREE.BufferAttribute( steps, 2 ) );
		geo.computeBoundingSphere();
		return geo;

	}

	buildMaterial() {

		const mat = new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide, transparent: true, depthWrite: true } );
		const vNormal = varyingProperty( 'vec3', 'vEwNormal' );
		const vWorld = varyingProperty( 'vec3', 'vEwWorld' );
		const vCrest = varyingProperty( 'float', 'vEwCrest' );
		const vJacobian = varyingProperty( 'float', 'vEwJacobian' );

		mat.positionNode = Fn( () => {

			const step = attribute( 'snapStep', 'vec2' );
			const p = round( positionGeometry.xz.add( this.uOffset ).div( step ) ).mul( step ).toVar();
			const w = etheriumWaves( p, this.uWaves, this.uTime, this.uHeight, cameraPosition.xz );

			// the big billows lift the mesh near the camera (further out they're only shading)
			const xz = p.add( w.disp.xz );
			const near = smoothstep( 220.0, 90.0, length( xz.sub( cameraPosition.xz ) ) );
			const lift = billow( xz, this.uTime, float( 0 ) ).h.mul( near );
			vNormal.assign( normalize( cross( w.bin, w.tan ) ) );
			vWorld.assign( vec3( xz.x, w.disp.y.add( lift ), xz.y ) );
			vCrest.assign( w.disp.y.div( this.uMaxAmp ) );
			vJacobian.assign( w.jacobian );
			return vec3( p.x.sub( this.uOffset.x ), lift, p.y.sub( this.uOffset.y ) ).add( w.disp );

		} )();

		// palette uniforms share the PALETTE Color objects, so editing a colour updates the shader live
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );


		mat.colorNode = Fn( () => {

			const t = this.uTime;
			const P = vWorld;
			const n = normalize( vNormal );
			const V = normalize( cameraPosition.sub( P ) );
			const L = this.uSunDir;
			const dist = length( cameraPosition.sub( P ) );
			// the volumetric etherium draws the near sea: hand over through a dithered band (TRAA smooths it)
			If( this.uVolumeRange.greaterThan( 0 ), () => {

				const dither = fract( fract( dot( screenCoordinate.xy, vec2( 0.06711056, 0.00583715 ) ) ).mul( 52.9829189 ) );
				If( dist.lessThan( this.uVolumeRange.mul( dither.mul( 0.15 ).add( 0.65 ) ) ), () => {

					Discard();

				} );

			} );

			// cloud tops: per-pixel billow bumps on top of the swell (finite-difference slope of both octaves)
			const fine = smoothstep( 160.0, 40.0, dist ); // the small lumps fade out with distance
			const e = 0.3;
			const b0 = billow( P.xz, t, fine );
			const bx = billow( P.xz.add( vec2( e, 0 ) ), t, fine ).h;
			const bz = billow( P.xz.add( vec2( 0, e ) ), t, fine ).h;
			const bump = smoothstep( 300.0, 40.0, dist ).mul( 2.0 );
			const nb = normalize( n.add( vec3( bx.sub( b0.h ).div( e ).negate(), 0, bz.sub( b0.h ).div( e ).negate() ).mul( bump ) ) );
			const N = select( frontFacing, nb, nb.negate() );

			const crest = smoothstep( - 0.3, 0.75, vCrest );
			const tint = mx_noise_float( vec3( P.xz.mul( 0.005 ), t.mul( 0.02 ) ) ).mul( 0.5 ).add( 0.5 ).clamp();
			const col = cloudColor( N, L, V, crest, tint, b0.occ, c ).toVar();

			// glowing puffs where crests pinch (low Jacobian)
			const hot = mix( c( 'crestA' ), c( 'crestB' ), tint.oneMinus() );
			col.addAssign( hot.mul( smoothstep( 0.65, 0.3, vJacobian ) ).mul( 0.35 ) );

			// regions tint the sea (the Flare Reach runs hotter, the Ring Reach frostier);
			// a flare-front's face glows like molten gold
			col.assign( this.regionTint( col ) );
			col.addAssign( vec3( ...FLARE_TINT.glow ).mul( pow( flareHeight( P.xz ).div( FLARES.height ), 2 ) ).mul( 0.55 ) );

			// distant cloud tops soften into the haze
			col.assign( mix( col, this.uFogColor.mul( 2.2 ).add( c( 'rim' ).mul( 0.15 ) ), smoothstep( 150.0, 900.0, dist ).mul( 0.35 ) ) );

			// underside: a dim violet glow seen through the fog
			const under = c( 'underside' ).mul( b0.occ.mul( 0.8 ).add( 0.3 ) ).add( c( 'crestB' ).mul( crest.mul( 0.25 ) ) );
			return select( frontFacing, col, under );

		} )();

		// see-through gas: thin in the creases near you, dense on the lump tops and further out
		mat.opacityNode = Fn( () => {

			const P = vWorld;
			const dist = length( cameraPosition.sub( P ) );
			const b = billow( P.xz, this.uTime, smoothstep( 160.0, 40.0, dist ) );
			const thin = mix( float( CLOUD.clear ), float( 1 ), b.occ.mul( b.occ ) );
			return select( frontFacing, mix( thin, float( 1 ), smoothstep( CLOUD.clearNear, CLOUD.clearFar, dist ) ), float( 1 ) );

		} )();

		return mat;

	}

	// the volumetric etherium (sea/Volume.js) takes over the near sea: the mesh turns opaque, drops its
	// near part (see the colour shader) and the deep layer goes
	useVolume( range ) {

		this.uVolumeRange.value = range;
		const m = this.mesh.material;
		m.transparent = false;
		m.opacityNode = null;
		m.needsUpdate = true;
		this.deep.visible = false;

	}

	// TSL: a region's tint on a cloud colour (multiply, or repaint keeping brightness), blended in as you
	// enter. Shared by the sea, its deep layer and the cloud puffs.
	regionTint( col ) {

		const recolor = mix( col.mul( this.uRegionSea ), vec3( dot( col, vec3( 0.3, 0.55, 0.15 ) ) ).mul( this.uRegionSea ).mul( 1.6 ), this.uRegionRecolor );
		return mix( col, recolor, this.uFlareMix );

	}

	// The deep layer: a dimmer, slower copy of the swell CLOUD.deep metres down, glowing faintly through
	// the clear patches of the top layer, so you look into the cloud rather than at a skin.
	buildDeepMaterial() {

		const mat = new THREE.MeshBasicNodeMaterial();
		const vWorld = varyingProperty( 'vec3', 'vDeepWorld' );
		const vCrest = varyingProperty( 'float', 'vDeepCrest' );
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );

		mat.positionNode = Fn( () => {

			const step = attribute( 'snapStep', 'vec2' );
			const p = round( positionGeometry.xz.add( this.uOffset ).div( step ) ).mul( step ).toVar();
			const w = etheriumWaves( p, this.uWaves, this.uTime, this.uHeight, cameraPosition.xz );
			const y = w.disp.y.mul( 0.5 ).sub( CLOUD.deep );
			vWorld.assign( vec3( p.x.add( w.disp.x ), y, p.y.add( w.disp.z ) ) );
			vCrest.assign( w.disp.y.div( this.uMaxAmp ) );
			return vec3( p.x.sub( this.uOffset.x ).add( w.disp.x ), y, p.y.sub( this.uOffset.y ).add( w.disp.z ) );

		} )();

		mat.colorNode = Fn( () => {

			const t = this.uTime;
			const P = vWorld;
			const tint = mx_noise_float( vec3( P.xz.mul( 0.007 ), t.mul( 0.02 ).add( 3.1 ) ) ).mul( 0.5 ).add( 0.5 ).clamp();
			const b = billow( P.xz.mul( 0.5 ).add( 40 ), t.mul( 0.5 ), float( 0 ) );
			const crest = smoothstep( - 0.3, 0.9, vCrest );
			const base = mix( mix( c( 'cloudShadeA' ), c( 'cloudShadeB' ), tint ), mix( c( 'cloudLitA' ), c( 'cloudLitB' ), tint ).mul( 0.55 ), b.occ );
			return this.regionTint( base.add( mix( c( 'crestA' ), c( 'crestB' ), tint ).mul( crest.mul( crest ) ).mul( 0.3 ) ) );

		} )();

		return mat;

	}

	// JS twin of etheriumWaves: displacement and normal of the grid point (x, z).
	// mode: 'full' (displacement and normal), 'height' (displacement only), 'shift' (sideways only).
	// The extra lifts (bow waves, flare-fronts, ring waves) only move the surface up and down, so 'shift'
	// skips them, and only 'full' pays for their finite-difference slope.
	sampleGrid( x, z, t, out, mode = 'full' ) {

		const calm = harborCalm( x, z );
		if ( mode === 'shift' ) {

			let dx = 0, dz = 0;
			for ( const w of this.waves ) {

				const amp = w.s * calm / w.k * Math.cos( w.k * ( w.dx * x + w.dz * z ) - w.omega * t );
				dx += w.dx * amp; dz += w.dz * amp;

			}
			out.dx = dx; out.dz = dz;
			return out;

		}

		const H = SEA.height * swellFactorJS( x, z ), HX = SEA.height, full = mode === 'full';
		let dx = 0, dy = 0, dz = 0, tx = 1, ty = 0, tz = 0, bx = 0, by = 0, bz = 1;
		for ( const w of this.waves ) {

			const f = w.k * ( w.dx * x + w.dz * z ) - w.omega * t;
			const c = Math.cos( f ), sn = Math.sin( f );
			const s = w.s * calm;
			const amp = s / w.k;
			dx += w.dx * amp * c; dy += amp * sn * H; dz += w.dz * amp * c;
			if ( full ) {

				const ss = s * sn, sc = s * c * H;
				tx -= w.dx * w.dx * ss; ty += w.dx * sc; tz -= w.dx * w.dz * ss;
				bx -= w.dx * w.dz * ss; by += w.dz * sc; bz -= w.dz * w.dz * ss;

			}

		}
		// the extra lifts: height, plus a finite-difference slope for the normal (matches etheriumWaves)
		const bh = extraHeightJS( x, z, t );
		dy += bh * HX;
		out.dx = dx; out.dy = dy; out.dz = dz;
		if ( full ) {

			const e = 0.6;
			ty += ( extraHeightJS( x + e, z, t ) - bh ) / e * HX;
			by += ( extraHeightJS( x, z + e, t ) - bh ) / e * HX;
			out.nx = by * tz - bz * ty; out.ny = bz * tx - bx * tz; out.nz = bx * ty - by * tx;

		}
		return out;

	}

	// Gerstner waves move points sideways, so find the grid point that lands on (x, z); the refinement
	// steps only need the sideways shift.
	_solve( x, z, t, mode ) {

		const s = this._s || ( this._s = {} );
		let px = x, pz = z;
		for ( let i = 0; i < 4; i ++ ) {

			this.sampleGrid( px, pz, t, s, 'shift' );
			px = x - s.dx; pz = z - s.dz;

		}
		return this.sampleGrid( px, pz, t, s, mode );

	}

	// Surface height at world (x, z).
	heightAt( x, z, t = this.time ) {

		return this._solve( x, z, t, 'height' ).dy;

	}

	// Surface normal at world (x, z).
	normalAt( x, z, t = this.time, target = new THREE.Vector3() ) {

		const s = this._solve( x, z, t, 'full' );
		return target.set( s.nx, s.ny, s.nz ).normalize();

	}

	update( time, camera ) {

		this.time = time;
		this.uTime.value = time;

		this.mesh.position.x = Math.round( camera.position.x / SNAP ) * SNAP;
		this.mesh.position.z = Math.round( camera.position.z / SNAP ) * SNAP;
		this.uOffset.value.set( this.mesh.position.x, this.mesh.position.z );

		this.underwater = camera.position.y < this.heightAt( camera.position.x, camera.position.z );
		this.uFogColor.value.copy( this.underwater ? PALETTE.fogBelow : PALETTE.fogAbove );
		if ( this.regionMix > 0 && ! this.underwater ) this.uFogColor.value.lerp( this.regionFog, this.regionMix );
		this.uFlareMix.value = this.regionMix;
		this.uFogDensity.value = this.underwater ? FOG.below : FOG.above;
		this.uUnderwater.value = this.underwater ? 1 : 0;

	}

}
