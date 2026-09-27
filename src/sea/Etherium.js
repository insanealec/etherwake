import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec3, sin, cos, dot, length, normalize, cross, max, pow, smoothstep, mix, reflect, select,
	positionGeometry, cameraPosition, frontFacing, varyingProperty, fog, densityFogFactor,
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
const PALETTE = {
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

const FOG_ABOVE = 0.0011;
const FOG_BELOW = 0.03;

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
		this.uFogDensity = uniform( FOG_ABOVE );
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
		for ( let i = 0; i < pos.count; i ++ ) {

			pos.setX( i, remap( pos.getX( i ) ) );
			pos.setZ( i, remap( pos.getZ( i ) ) );

		}
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

			const p = positionGeometry.xz.add( this.uOffset );
			const w = etheriumWaves( p, this.uWaves, this.uTime, this.uHeight, cameraPosition.xz );

			vNormal.assign( normalize( cross( w.bin, w.tan ) ) );
			vWorld.assign( vec3( p.x.add( w.disp.x ), w.disp.y, p.y.add( w.disp.z ) ) );
			vCrest.assign( w.disp.y.div( this.uMaxAmp ) );
			vJacobian.assign( w.jacobian );
			return positionGeometry.add( w.disp );

		} )();

		const c = ( k ) => vec3( PALETTE[ k ].r, PALETTE[ k ].g, PALETTE[ k ].b );

		mat.colorNode = Fn( () => {

			const t = this.uTime;
			const P = vWorld;
			const n = normalize( vNormal );
			const N = select( frontFacing, n, n.negate() );
			const V = normalize( cameraPosition.sub( P ) );
			const fres = pow( max( dot( N, V ), 0 ).oneMinus(), 8 );

			// cloudy texture and large-scale colour drift
			const cloud = mx_fractal_noise_float( vec3( P.xz.mul( 0.015 ), t.mul( 0.04 ) ), 4, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 ).clamp();
			const tint = mx_noise_float( vec3( P.xz.mul( 0.005 ), t.mul( 0.02 ) ) ).mul( 0.5 ).add( 0.5 ).clamp();

			// troughs teal/violet, crests gold/rose, glow rising with height
			const crest = smoothstep( - 0.3, 0.75, vCrest );
			const trough = mix( c( 'troughA' ), c( 'troughB' ), tint );
			const hot = mix( c( 'crestA' ), c( 'crestB' ), tint.oneMinus() );
			const glow = mix( float( 0.9 ), float( 1.0 ), crest ).mul( cloud.mul( 1.1 ).add( 0.35 ) );
			const col = mix( trough, hot, crest.mul( crest ) ).mul( glow ).toVar();

			// foam where the surface pinches (low Jacobian), sparkles on foam and high crests
			const foam = smoothstep( 0.6, 0.3, vJacobian ).mul( cloud.mul( 0.6 ).add( 0.4 ) );
			col.assign( mix( col, c( 'foam' ), foam.mul( 0.55 ) ) );
			const sp = mx_noise_float( vec3( P.xz.mul( 1.4 ), t.mul( 1.2 ) ) );
			const near = smoothstep( 160, 20, length( cameraPosition.sub( P ) ) );
			const sparkle = smoothstep( 0.62, 0.8, sp ).mul( foam.add( pow( crest, 8 ).mul( 0.5 ) ) ).mul( near );
			col.addAssign( c( 'foam' ).mul( sparkle ).mul( 2.0 ) );

			// sun glint and fresnel rim
			const R = reflect( V.negate(), N );
			col.addAssign( c( 'sun' ).mul( pow( max( dot( R, this.uSunDir ), 0 ), 90 ).mul( 1.5 ) ) );
			col.addAssign( c( 'rim' ).mul( fres ).mul( 0.35 ) );

			// underside: a dim violet glow seen through the fog
			const under = c( 'underside' ).mul( cloud.mul( 0.8 ).add( 0.3 ) ).add( c( 'crestB' ).mul( crest.mul( 0.25 ) ) );
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
		this.uFogDensity.value = this.underwater ? FOG_BELOW : FOG_ABOVE;

	}

}
