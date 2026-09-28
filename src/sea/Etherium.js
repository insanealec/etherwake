import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, sin, cos, dot, length, normalize, cross, max, pow, smoothstep, mix, select,
	positionGeometry, attribute, round, cameraPosition, frontFacing, varyingProperty, fog, densityFogFactor,
	mx_fractal_noise_float, mx_noise_float
} from 'three/tsl';
import { SEA, WAVES } from './Waves.js';

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
	rim: new THREE.Color( 0.30, 0.10, 0.55 ),
	sun: new THREE.Color( 1.00, 0.60, 0.30 ),
	underside: new THREE.Color( 0.08, 0.015, 0.16 ),
	fogAbove: new THREE.Color( 0.10, 0.02, 0.09 ),
	fogBelow: new THREE.Color( 0.04, 0.008, 0.10 )
};

export const FOG = { above: 0.0011, below: 0.03 };

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
	const disp = vec3( 0 ).toVar();
	const tan = vec3( 1, 0, 0 ).toVar();
	const bin = vec3( 0, 0, 1 ).toVar();

	for ( const { a, b } of waves ) {

		const dx = a.x, dz = a.y, k = a.z;
		const s = a.w.mul( smoothstep( b.y, b.z, dist ).oneMinus() );
		const f = k.mul( dot( a.xy, p ) ).sub( b.x.mul( time ) );
		const c = cos( f ), sn = sin( f );
		const amp = s.div( k );
		const ss = s.mul( sn ), sc = s.mul( c ).mul( height );

		disp.addAssign( vec3( dx.mul( amp ).mul( c ), amp.mul( sn ).mul( height ), dz.mul( amp ).mul( c ) ) );
		tan.addAssign( vec3( dx.mul( dx ).mul( ss ).negate(), dx.mul( sc ), dx.mul( dz ).mul( ss ).negate() ) );
		bin.addAssign( vec3( dx.mul( dz ).mul( ss ).negate(), dz.mul( sc ), dz.mul( dz ).mul( ss ).negate() ) );

	}

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
		this.uWaves = WAVES.map( () => ( { a: uniform( new THREE.Vector4() ), b: uniform( new THREE.Vector4() ) } ) );
		this.refresh();

		scene.fogNode = fog( this.uFogColor, densityFogFactor( this.uFogDensity ) );

		this.mesh = new THREE.Mesh( this.buildGeometry(), this.buildMaterial() );
		this.mesh.frustumCulled = false;
		scene.add( this.mesh );

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

	buildGeometry() {

		const geo = new THREE.PlaneGeometry( 2, 2, SEGMENTS, SEGMENTS );
		geo.rotateX( - Math.PI / 2 );
		const pos = geo.attributes.position;
		const remap = ( u ) => HALF * u * ( CENTER + ( 1 - CENTER ) * u * u );
		// local vertex spacing rounded down to SNAP * 2^n: the shader snaps each vertex to this
		// world-fixed lattice, so waves don't swim across the sparse outer grid as it follows the camera
		const step = ( u ) => {

			const ds = HALF * ( CENTER + 3 * ( 1 - CENTER ) * u * u ) * 2 / SEGMENTS;
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

		const mat = new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide } );
		const vNormal = varyingProperty( 'vec3', 'vEwNormal' );
		const vWorld = varyingProperty( 'vec3', 'vEwWorld' );
		const vCrest = varyingProperty( 'float', 'vEwCrest' );
		const vJacobian = varyingProperty( 'float', 'vEwJacobian' );

		mat.positionNode = Fn( () => {

			const step = attribute( 'snapStep', 'vec2' );
			const p = round( positionGeometry.xz.add( this.uOffset ).div( step ) ).mul( step ).toVar();
			const w = etheriumWaves( p, this.uWaves, this.uTime, this.uHeight, cameraPosition.xz );

			vNormal.assign( normalize( cross( w.bin, w.tan ) ) );
			vWorld.assign( vec3( p.x.add( w.disp.x ), w.disp.y, p.y.add( w.disp.z ) ) );
			vCrest.assign( w.disp.y.div( this.uMaxAmp ) );
			vJacobian.assign( w.jacobian );
			return vec3( p.x.sub( this.uOffset.x ), 0, p.y.sub( this.uOffset.y ) ).add( w.disp );

		} )();

		// palette uniforms share the PALETTE Color objects, so editing a colour updates the shader live
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );


		mat.colorNode = Fn( () => {

			const t = this.uTime;
			const P = vWorld;
			const n = normalize( vNormal );
			const N = select( frontFacing, n, n.negate() );
			const V = normalize( cameraPosition.sub( P ) );
			const L = this.uSunDir;

			// gas texture: domain-warped clouds drifting downwind, plus fine wisps stretched along the flow
			const uvw = P.xz.sub( vec2( 1.6, 0.4 ).mul( t ) );
			const wx = mx_fractal_noise_float( vec3( uvw.mul( 0.011 ), t.mul( 0.03 ) ), 3, 2.0, 0.5 );
			const wz = mx_fractal_noise_float( vec3( uvw.mul( 0.011 ).add( 5.2 ), t.mul( 0.03 ) ), 3, 2.0, 0.5 );
			const q = uvw.add( vec2( wx, wz ).mul( 16.0 ) );
			const big = mx_fractal_noise_float( vec3( q.mul( 0.035 ), t.mul( 0.05 ) ), 5, 2.0, 0.55 ).mul( 0.5 ).add( 0.5 ).clamp();
			const wisps = mx_fractal_noise_float( vec3( q.x.mul( 0.08 ), q.y.mul( 0.13 ), t.mul( 0.12 ) ), 3, 2.0, 0.55 ).mul( 0.5 ).add( 0.5 ).clamp();
			const dens = smoothstep( 0.3, 0.78, big.mul( 0.65 ).add( wisps.mul( 0.35 ) ) );
			const tint = mx_noise_float( vec3( P.xz.mul( 0.005 ), t.mul( 0.02 ) ) ).mul( 0.5 ).add( 0.5 ).clamp();

			// troughs teal/violet, crests gold/rose; glow rises with height and gas density
			const crest = smoothstep( - 0.3, 0.75, vCrest );
			const trough = mix( c( 'troughA' ), c( 'troughB' ), tint );
			const hot = mix( c( 'crestA' ), c( 'crestB' ), tint.oneMinus() );
			// thin gas goes nearly dark, dense gas glows; the densest filaments run hot
			const lum = mix( float( 0.1 ), float( 1.0 ), dens ).mul( mix( float( 0.55 ), float( 1.35 ), crest ) );
			const col = mix( trough, hot, crest.mul( crest ) ).mul( lum ).add( hot.mul( pow( dens, 3 ) ).mul( 0.3 ) ).toVar();

			// soft sun-facing shading keeps the swell slopes readable (diffuse, not a glassy highlight)
			col.mulAssign( mix( float( 0.6 ), float( 1.2 ), dot( N, L ).mul( 0.5 ).add( 0.5 ) ) );

			// glowing puffs where crests pinch (low Jacobian), instead of white foam
			const puff = smoothstep( 0.65, 0.3, vJacobian ).mul( dens );
			col.addAssign( hot.mul( puff ).mul( 0.7 ) );

			// back-lit gas: looking toward the sun, thin gas glows (a silver lining instead of a glint)
			const back = pow( max( dot( V.negate(), L ), 0 ), 6 ).mul( dens );
			col.addAssign( c( 'sun' ).mul( back ).mul( 0.9 ) );

			// grazing angles look through more gas: thicken toward the fog colour
			const thick = pow( max( dot( N, V ), 0 ).oneMinus(), 6 );
			col.assign( mix( col, this.uFogColor.mul( 2.2 ).add( c( 'rim' ).mul( 0.15 ) ), thick.mul( 0.3 ) ) );

			// underside: a dim violet glow seen through the fog
			const under = c( 'underside' ).mul( dens.mul( 0.8 ).add( 0.3 ) ).add( c( 'crestB' ).mul( crest.mul( 0.25 ) ) );
			return select( frontFacing, col, under );

		} )();

		return mat;

	}

	// JS twin of etheriumWaves: displacement and normal of the grid point (x, z).
	sampleGrid( x, z, t, out ) {

		const H = SEA.height;
		let dx = 0, dy = 0, dz = 0, tx = 1, ty = 0, tz = 0, bx = 0, by = 0, bz = 1;
		for ( const w of this.waves ) {

			const f = w.k * ( w.dx * x + w.dz * z ) - w.omega * t;
			const c = Math.cos( f ), sn = Math.sin( f );
			const amp = w.s / w.k, ss = w.s * sn, sc = w.s * c * H;
			dx += w.dx * amp * c; dy += amp * sn * H; dz += w.dz * amp * c;
			tx -= w.dx * w.dx * ss; ty += w.dx * sc; tz -= w.dx * w.dz * ss;
			bx -= w.dx * w.dz * ss; by += w.dz * sc; bz -= w.dz * w.dz * ss;

		}
		out.dx = dx; out.dy = dy; out.dz = dz;
		out.nx = by * tz - bz * ty; out.ny = bz * tx - bx * tz; out.nz = bx * ty - by * tx;
		return out;

	}

	// Gerstner waves move points sideways, so find the grid point that lands on (x, z).
	_solve( x, z, t ) {

		const s = this._s || ( this._s = {} );
		let px = x, pz = z;
		for ( let i = 0; i < 4; i ++ ) {

			this.sampleGrid( px, pz, t, s );
			px = x - s.dx; pz = z - s.dz;

		}
		return this.sampleGrid( px, pz, t, s );

	}

	// Surface height at world (x, z).
	heightAt( x, z, t = this.time ) {

		return this._solve( x, z, t ).dy;

	}

	// Surface normal at world (x, z).
	normalAt( x, z, t = this.time, target = new THREE.Vector3() ) {

		const s = this._solve( x, z, t );
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
		this.uFogDensity.value = this.underwater ? FOG.below : FOG.above;
		this.uUnderwater.value = this.underwater ? 1 : 0;

	}

}
