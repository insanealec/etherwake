import * as THREE from 'three/webgpu';
import { Fn, vec3, dot, smoothstep, mix, normalLocal, normalWorld, mx_fractal_noise_float, mx_worley_noise_float } from 'three/tsl';

// A small icy moon, like the gas giant fixed "at infinity" (follows the camera). Grey-blue ice with
// Worley-noise craters and a crisp terminator lit by the sun.
const DIR = new THREE.Vector3( 0.15, 0.48, 0.86 ).normalize();
const DISTANCE = 8000;
const RADIUS = 220; // ~3 degrees across

export class Moon {

	constructor( scene, sunDir ) {

		const mat = new THREE.MeshBasicNodeMaterial( { fog: false } );
		mat.colorNode = Fn( () => {

			const n = normalLocal;
			const mottled = mx_fractal_noise_float( n.mul( 4.0 ), 4, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const craters = smoothstep( 0.05, 0.3, mx_worley_noise_float( n.mul( 7.0 ) ) );
			const small = smoothstep( 0.02, 0.2, mx_worley_noise_float( n.mul( 19.0 ).add( 4.0 ) ) );
			const albedo = mix( vec3( 0.32, 0.36, 0.45 ), vec3( 0.75, 0.82, 0.92 ), mottled ).mul( craters.mul( 0.35 ).add( 0.65 ) ).mul( small.mul( 0.2 ).add( 0.8 ) );

			const lit = smoothstep( - 0.02, 0.25, dot( normalWorld, sunDir ) );
			return albedo.mul( lit.mul( 1.3 ) ).add( vec3( 0.004, 0.005, 0.012 ) ); // faint earthshine-ish night side

		} )();

		this.mesh = new THREE.Mesh( new THREE.SphereGeometry( RADIUS, 48, 32 ), mat );
		this.mesh.frustumCulled = false;
		scene.add( this.mesh );

	}

	update( camera ) {

		this.mesh.position.copy( camera.position ).addScaledVector( DIR, DISTANCE );

	}

}
