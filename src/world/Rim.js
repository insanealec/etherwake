import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec3, float, sin, cos, atan, length, dot, max, pow, normalize, smoothstep, mix, positionLocal, positionWorld, normalWorld, cameraPosition, mx_noise_float } from 'three/tsl';
import { REGIONS } from './WorldLayout.js';
import { RIM } from '../game/Rim.js';

function mulberry32( a ) {

	return () => {

		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul( a ^ a >>> 15, 1 | a );
		t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
		return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

	};

}

const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

// The black hole on screen, for the lensing post pass (App.buildPipeline): x, y in screen UV,
// z = event-horizon radius as a fraction of the screen height, w = 1 when it's in front of the camera.
export const uLens = uniform( new THREE.Vector4( 0.5, 0.5, 0, 0 ) );

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

// The Rim (milestone 8): the black hole hanging over the region (horizon, photon ring, accretion disk;
// the lensing is a post pass fed by uLens), void pearls high above the swell, the swirling current and
// the low gravity. onPearl( position ) reports pickups.
export class Rim {

	constructor( scene, sea ) {

		this.sea = sea;
		this.onPearl = null;
		this.time = 0;
		const R = this.region = REGIONS.rim, H = RIM.hole;
		this.center = new THREE.Vector3( R.x, H.height, R.z + H.ahead );

		const hole = new THREE.Group();
		hole.position.copy( this.center );
		scene.add( hole );

		// the event horizon: pure black, hiding the stars behind it
		hole.add( new THREE.Mesh( new THREE.SphereGeometry( H.radius, 48, 32 ), new THREE.MeshBasicNodeMaterial( { color: 0x000000, fog: false } ) ) );

		// the photon ring: a thin bright rim just outside the horizon
		const ringMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false } );
		ringMat.colorNode = Fn( () => {

			const v = normalize( cameraPosition.sub( positionWorld ) );
			return vec3( 2.4, 1.3, 0.6 ).mul( pow( max( dot( normalWorld, v ), 0 ).oneMinus(), 5 ) );

		} )();
		hole.add( new THREE.Mesh( new THREE.SphereGeometry( H.radius * 1.12, 48, 32 ), ringMat ) );

		// the accretion disk: white-hot inside, orange outside, streaked and swirling, one side brighter
		const t = sea.uTime;
		const diskMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false } );
		diskMat.colorNode = Fn( () => {

			const p = positionLocal.xy, r = length( p ), a = atan( p.y, p.x );
			const k = r.sub( H.disk[ 0 ] ).div( H.disk[ 1 ] - H.disk[ 0 ] ).clamp();
			const swirl = a.mul( 6.0 ).sub( t.mul( 90.0 ).div( r ) ); // inner parts orbit faster
			const streaks = mx_noise_float( vec3( cos( swirl ), sin( swirl ), r.mul( 0.012 ) ) ).mul( 0.5 ).add( 0.6 );
			const hot = mix( vec3( 1.2, 0.85, 0.55 ), vec3( 0.55, 0.14, 0.03 ), pow( k, 0.6 ) );
			const beaming = cos( a ).mul( 0.55 ).add( 1.0 );
			return hot.mul( streaks ).mul( beaming ).mul( pow( k.oneMinus(), 1.4 ) ).mul( smoothstep( 0.0, 0.05, k ) );

		} )();
		const disk = new THREE.Mesh( new THREE.RingGeometry( H.disk[ 0 ], H.disk[ 1 ], 160, 8 ), diskMat );
		disk.rotation.x = - Math.PI / 2 + H.tilt;
		hole.add( disk );
		this.hole = hole;

		// void pearls: dark-violet orbs hanging high over the swell
		const rand = mulberry32( 777 );
		this.pearls = [];
		for ( let i = 0; i < RIM.pearls; i ++ ) {

			const a = rand() * Math.PI * 2, r = RIM.inner + 40 + rand() * ( R.radius * 0.9 - RIM.inner - 40 );
			const [ h0, h1 ] = RIM.pearlHeight;
			this.pearls.push( { x: R.x + Math.cos( a ) * r, z: R.z + Math.sin( a ) * r, lift: h0 + rand() * ( h1 - h0 ), taken: false, back: 0 } );

		}
		const pMat = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 1.6, 0.5, 3.4 ) } );
		this.pearlMesh = new THREE.InstancedMesh( new THREE.IcosahedronGeometry( 0.7, 2 ), pMat, this.pearls.length );
		this.pearlMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.pearlMesh.frustumCulled = false;
		scene.add( this.pearlMesh );

	}

	// how strongly the Rim acts at (x, z): 0 outside, 1 well inside
	strength( x, z ) {

		const R = this.region;
		return smooth( R.radius, R.radius * 0.75, Math.hypot( x - R.x, z - R.z ) );

	}

	// air gravity multiplier at (x, z): lighter inside the Rim
	gravityAt( x, z ) {

		return 1 - ( 1 - RIM.gravity ) * this.strength( x, z );

	}

	// the swirling current's push (m/s²) at (x, z): round the centre, strongest in the middle band
	current( x, z, out ) {

		const R = this.region, dx = x - R.x, dz = z - R.z, r = Math.hypot( dx, dz ) || 1;
		const k = RIM.swirl * smooth( RIM.inner * 0.6, RIM.inner * 1.6, r ) * smooth( R.radius, R.radius * 0.6, r );
		return out.set( - dz / r * k, 0, dx / r * k );

	}

	// camera: for the lensing uniforms; rider: the surfer, or null when on foot
	update( dt, camera, rider ) {

		this.time += dt;
		const sea = this.sea;

		// lensing: where the hole is on screen and how big
		_v.copy( this.center ).project( camera );
		_r.setFromMatrixColumn( camera.matrixWorld, 0 ).multiplyScalar( RIM.hole.radius ).add( this.center ).project( camera );
		const inFront = _v.z < 1 && _v.z > - 1;
		uLens.value.set( _v.x * 0.5 + 0.5, 0.5 - _v.y * 0.5, Math.abs( _r.x - _v.x ) * 0.5 * camera.aspect, inFront ? 1 : 0 );

		const cam = sea.mesh.position;
		this.pearls.forEach( ( p, i ) => {

			if ( p.taken && this.time > p.back ) {

				p.taken = false;
				p.dirty = true;

			}
			// far from the camera: leave it where it was (after the first full pass)
			if ( this.primed && ! p.dirty && ( Math.abs( p.x - cam.x ) > 700 || Math.abs( p.z - cam.z ) > 700 ) ) return;
			p.dirty = false;
			const y = sea.heightAt( p.x, p.z ) + p.lift + Math.sin( this.time * 1.2 + i ) * 0.4;
			let k = p.taken ? 0 : 1;
			if ( ! p.taken && rider && Math.hypot( rider.position.x - p.x, rider.position.z - p.z, rider.position.y + 0.8 - y ) < 3.5 ) {

				p.taken = true;
				p.back = this.time + RIM.pearlRespawn;
				k = 0;
				if ( this.onPearl ) this.onPearl( new THREE.Vector3( p.x, y, p.z ) );

			}
			this.pearlMesh.setMatrixAt( i, _m.compose( _s.set( p.x, y, p.z ), _q, new THREE.Vector3( k, k, k ) ) );

		} );
		this.pearlMesh.instanceMatrix.needsUpdate = true;
		this.primed = true;

	}

}
