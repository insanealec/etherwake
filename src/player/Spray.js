import * as THREE from 'three/webgpu';

const MAX = 240; // particle pool
const GRAVITY = 9;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

// Glowing etherium droplets: thrown off the outside rail when carving hard, and in a burst
// on landing. A pool of instanced low-poly spheres, shrinking as they age.
export class Spray {

	constructor( scene ) {

		this.particles = [];
		this.carry = 0; // fractional particles owed from the emission rate

		const mat = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 1.0, 0.36, 0.08 ), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } );
		this.mesh = new THREE.InstancedMesh( new THREE.IcosahedronGeometry( 0.07, 0 ), mat, MAX );
		this.mesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.mesh.frustumCulled = false;
		this.mesh.count = 0;
		scene.add( this.mesh );

	}

	emit( pos, vel ) {

		if ( this.particles.length >= MAX ) this.particles.shift();
		const life = 0.5 + Math.random() * 0.5;
		this.particles.push( { p: pos.clone(), v: vel.clone(), age: 0, life, size: 0.6 + Math.random() * 0.8 } );

	}

	// n droplets fanning out around the board
	burst( surfer, n ) {

		for ( let i = 0; i < n; i ++ ) {

			const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 4;
			_s.set( Math.cos( a ) * r, 2 + Math.random() * 4, Math.sin( a ) * r ).addScaledVector( surfer.velocity, 0.4 );
			_s.y = Math.max( _s.y, 1.5 );
			this.emit( _p.copy( surfer.position ).setY( surfer.position.y + 0.1 ), _s );

		}

	}

	update( dt, surfer ) {

		// carving spray: rate grows with how hard you turn and how fast you go
		const carve = surfer.grounded && surfer.wipeout <= 0 ? Math.abs( surfer.steer ) * Math.max( 0, surfer.speed - 6 ) / 14 : 0;
		this.carry += carve * 140 * dt;
		if ( this.carry >= 1 ) {

			const fx = Math.sin( surfer.yaw ), fz = Math.cos( surfer.yaw );
			// outside of the turn: steering right (positive) throws spray to the left (+x local)
			const side = surfer.steer > 0 ? 1 : - 1;
			const rx = fz * side, rz = - fx * side; // local +x in world, times side
			while ( this.carry >= 1 ) {

				this.carry -= 1;
				const along = - 0.2 - Math.random() * 0.6;
				_p.set( surfer.position.x + rx * 0.35 + fx * along, surfer.position.y + 0.1, surfer.position.z + rz * 0.35 + fz * along );
				const out = 2 + Math.random() * 3 * carve, up = 2 + Math.random() * 3.5 * carve;
				_s.set( rx * out + surfer.velocity.x * 0.55, up, rz * out + surfer.velocity.z * 0.55 );
				_s.x += ( Math.random() - 0.5 ) * 1.5;
				_s.z += ( Math.random() - 0.5 ) * 1.5;
				this.emit( _p, _s );

			}

		}

		// integrate and write instances
		let n = 0;
		for ( let i = this.particles.length - 1; i >= 0; i -- ) {

			const q = this.particles[ i ];
			q.age += dt;
			if ( q.age >= q.life ) {

				this.particles.splice( i, 1 );
				continue;

			}
			q.v.y -= GRAVITY * dt;
			q.v.multiplyScalar( Math.exp( - 1.2 * dt ) );
			q.p.addScaledVector( q.v, dt );
			const k = q.size * ( 1 - q.age / q.life );
			_m.compose( q.p, _q, _s.set( k, k, k ) );
			this.mesh.setMatrixAt( n ++, _m );

		}
		this.mesh.count = n;
		this.mesh.instanceMatrix.needsUpdate = true;

	}

}
