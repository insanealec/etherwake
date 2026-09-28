import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec3, sin, cos, dot, length, normalize, max, pow, smoothstep, mix, abs,
	normalLocal, normalWorld, positionLocal, positionWorld, cameraPosition, mx_fractal_noise_float
} from 'three/tsl';

// Placement: a fixed direction and distance from the camera, so it sits "at infinity" (no parallax).
const DIR = new THREE.Vector3( 0.75, 0.33, - 0.55 ).normalize();
const DISTANCE = 9000;
const RADIUS = 1900;
const RING_INNER = 1.35;
const RING_OUTER = 2.3;

const C = ( r, g, b ) => vec3( r, g, b ); // linear colours: keep them saturated

// The gas giant and its rings (milestone 3). Banded clouds with differential rotation and a storm,
// a soft terminator lit by the sun, an atmospheric rim, and rings that catch the planet's shadow.
export class GasGiant {

	constructor( scene, sunDir ) {

		this.uTime = uniform( 0 );
		this.uCenter = uniform( new THREE.Vector3() );
		this.sunDir = sunDir;

		this.group = new THREE.Group();
		this.planet = new THREE.Mesh( new THREE.SphereGeometry( RADIUS, 96, 64 ), this.planetMaterial() );
		this.planet.rotation.z = 0.35; // axial tilt
		this.group.add( this.planet );

		const ringGeo = new THREE.RingGeometry( RADIUS * RING_INNER, RADIUS * RING_OUTER, 160, 1 );
		this.rings = new THREE.Mesh( ringGeo, this.ringMaterial() );
		this.rings.rotation.set( - Math.PI / 2 + 0.28, 0, 0.35 ); // in the equatorial plane, tilted toward us
		this.rings.renderOrder = 2;
		this.group.add( this.rings );

		for ( const m of [ this.planet, this.rings ] ) m.frustumCulled = false;
		scene.add( this.group );

	}

	planetMaterial() {

		const mat = new THREE.MeshBasicNodeMaterial( { fog: false } );
		const t = this.uTime;

		mat.colorNode = Fn( () => {

			const n = normalLocal;
			const lat = n.y;

			// differential rotation: each latitude band drifts at its own rate
			const theta = t.mul( 0.015 ).mul( sin( lat.mul( 17.0 ) ).mul( 0.8 ).add( 1.0 ) );
			const p = vec3( n.x.mul( cos( theta ) ).sub( n.z.mul( sin( theta ) ) ), lat, n.x.mul( sin( theta ) ).add( n.z.mul( cos( theta ) ) ) );

			// bands: latitude warped by turbulence
			const turb = mx_fractal_noise_float( p.mul( vec3( 3.0, 9.0, 3.0 ) ), 5, 2.0, 0.55 );
			const b = lat.mul( 9.0 ).add( turb.mul( 0.9 ) );
			const t1 = sin( b.mul( 2.1 ) ).mul( 0.5 ).add( 0.5 );
			const t2 = sin( b.mul( 5.3 ).add( 1.3 ) ).mul( 0.5 ).add( 0.5 );
			const col = mix( mix( C( 0.42, 0.10, 0.04 ), C( 0.95, 0.42, 0.10 ), t1 ), C( 1.0, 0.78, 0.50 ), t2.mul( t2 ).mul( 0.7 ) ).toVar();

			// a great storm in the southern bands
			const storm = length( p.sub( normalize( vec3( 0.75, - 0.32, 0.58 ) ) ).mul( vec3( 1.0, 2.4, 1.0 ) ) );
			const swirl = mx_fractal_noise_float( p.mul( 14.0 ), 3, 2.0, 0.5 ).mul( 0.03 );
			col.assign( mix( col, C( 0.75, 0.12, 0.08 ), smoothstep( 0.2, 0.1, storm.add( swirl ) ) ) );

			// light: soft terminator, faint night side, warm atmospheric rim
			const N = normalWorld;
			const L = this.sunDir;
			const V = normalize( cameraPosition.sub( positionWorld ) );
			const lit = smoothstep( - 0.12, 0.4, dot( N, L ) );
			const rim = pow( max( dot( N, V ), 0 ).oneMinus(), 3 );
			const haze = C( 1.0, 0.45, 0.25 ).mul( rim ).mul( lit.add( 0.08 ) ).mul( 0.9 );
			return col.mul( lit.mul( 1.15 ).add( 0.015 ) ).add( haze );

		} )();

		return mat;

	}

	ringMaterial() {

		const mat = new THREE.MeshBasicNodeMaterial( { fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide } );

		const r = length( positionLocal.xy ).div( RADIUS ); // 1.35 .. 2.3 planet radii

		mat.colorNode = Fn( () => {

			const fine = mx_fractal_noise_float( vec3( r.mul( 60.0 ), 0, 0 ), 3, 2.0, 0.6 ).mul( 0.5 ).add( 0.5 );
			const col = mix( C( 0.55, 0.28, 0.20 ), C( 1.0, 0.82, 0.62 ), fine );

			// planet shadow: does the ray from this point toward the sun pass through the planet?
			const P = positionWorld.sub( this.uCenter );
			const L = this.sunDir;
			const tc = dot( P, L ).negate();
			const miss = length( P.add( L.mul( tc ) ) );
			const shadow = tc.greaterThan( 0 ).select( smoothstep( RADIUS * 0.97, RADIUS * 1.03, miss ), float( 1 ) );

			// flat plane: brightness from how square-on the sun hits it (either face)
			const Nr = normalize( normalWorld );
			const lit = abs( dot( Nr, L ) ).mul( 0.6 ).add( 0.25 );
			return col.mul( lit ).mul( shadow.mul( 0.95 ).add( 0.05 ) );

		} )();

		mat.opacityNode = Fn( () => {

			const bands = mx_fractal_noise_float( vec3( r.mul( 22.0 ), 5.0, 0 ), 4, 2.0, 0.55 ).mul( 0.5 ).add( 0.5 );
			const edges = smoothstep( RING_INNER, RING_INNER + 0.08, r ).mul( smoothstep( RING_OUTER, RING_OUTER - 0.12, r ) );
			const gap = smoothstep( 0.015, 0.04, abs( r.sub( 1.93 ) ) ); // a Cassini-like gap
			return bands.mul( 0.85 ).add( 0.1 ).mul( edges ).mul( gap ).mul( 0.9 );

		} )();

		return mat;

	}

	update( time, camera ) {

		this.uTime.value = time;
		this.group.position.copy( camera.position ).addScaledVector( DIR, DISTANCE );
		this.uCenter.value.copy( this.group.position );

	}

}
