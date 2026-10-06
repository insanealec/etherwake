import * as THREE from 'three/webgpu';
import { Fn, vec3, dot, max, pow, normalize, normalWorld, positionWorld, cameraPosition } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REGIONS, FROSTWATER } from './WorldLayout.js';
import { RINGS } from '../game/Rings.js';

function mulberry32( a ) {

	return () => {

		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul( a ^ a >>> 15, 1 | a );
		t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
		return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

	};

}

// a cluster of ice crystals, unit size, base at y = 0
function shardGeometry() {

	const parts = [];
	for ( const [ x, z, h, r, tx, tz ] of [ [ 0, 0, 2.2, 0.5, 0, 0 ], [ 0.35, 0.1, 1.4, 0.3, 0.35, 0.1 ], [ - 0.3, - 0.2, 1.1, 0.28, - 0.3, 0.2 ], [ 0.05, - 0.35, 0.9, 0.22, 0.1, - 0.4 ] ] ) {

		const c = new THREE.ConeGeometry( r, h, 6 );
		c.translate( 0, h / 2, 0 );
		c.rotateX( tz );
		c.rotateZ( - tx );
		c.translate( x, 0, z );
		parts.push( c );

	}
	return mergeGeometries( parts );

}

// icy: pale blue, glossy, with a cyan glow at the edges
function iceMaterial( glow = 0.5, fog = true ) {

	const mat = new THREE.MeshStandardNodeMaterial( { color: new THREE.Color( 0.45, 0.65, 0.85 ), roughness: 0.15, metalness: 0.1, fog } );
	mat.emissiveNode = Fn( () => {

		const v = normalize( cameraPosition.sub( positionWorld ) );
		const rim = pow( dot( normalWorld, v ).clamp().oneMinus(), 2 );
		return vec3( 0.1, 0.55, 0.8 ).mul( rim.mul( glow ).add( 0.04 ) );

	} )();
	return mat;

}

const CULL = 700; // metres: only shards and crystals this near the camera bob each frame
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

// The Ring Reach's ice (milestone 8): a great ice spire at the centre (the landmark, glowing through the
// haze), floating shards bobbing on the swell that stop the board (close shaves at speed pay), and rime
// crystals hovering among them. onShave() and onCrystal( position ) report those.
export class Rings {

	// avoid: points the shards keep clear of (the slalom gates), [ { x, z } ]
	constructor( scene, sea, avoid = [] ) {

		this.sea = sea;
		this.onShave = null;
		this.onCrystal = null;
		this.time = 0;
		const R = this.region = REGIONS.rings, rand = mulberry32( 4242 );

		// the spire: a towering crystal cluster, lit so it shows from far away
		this.spire = new THREE.Mesh( shardGeometry(), iceMaterial( 2.5, false ) );
		this.spire.scale.set( 45, 120, 45 );
		this.spire.position.set( R.x, - 30, R.z );
		scene.add( this.spire );

		// shards
		const clear = ( x, z ) => Math.hypot( x - R.x, z - R.z ) > 110 && Math.hypot( x - FROSTWATER.x, z - FROSTWATER.z ) > 45
			&& avoid.every( ( g ) => Math.hypot( x - g.x, z - g.z ) > RINGS.clearOfGates );
		this.shards = [];
		while ( this.shards.length < RINGS.shards ) {

			const a = rand() * Math.PI * 2, r = Math.sqrt( rand() ) * R.radius * 0.95;
			const x = R.x + Math.cos( a ) * r, z = R.z + Math.sin( a ) * r;
			if ( ! clear( x, z ) ) continue;
			const scale = RINGS.minScale + Math.pow( rand(), 2 ) * ( RINGS.maxScale - RINGS.minScale );
			this.shards.push( { x, z, scale, yaw: rand() * 6.28, tilt: ( rand() - 0.5 ) * 0.3, phase: rand() * 6.28, shaved: - 10 } );

		}
		this.mesh = new THREE.InstancedMesh( shardGeometry(), iceMaterial(), this.shards.length );
		this.mesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.mesh.frustumCulled = false;
		scene.add( this.mesh );

		// rime crystals beside some shards
		this.crystals = [];
		for ( let i = 0; i < RINGS.crystals; i ++ ) {

			const s = this.shards[ Math.floor( rand() * this.shards.length ) ];
			const a = rand() * Math.PI * 2, d = s.scale * 0.6 + 4 + rand() * 4;
			this.crystals.push( { x: s.x + Math.cos( a ) * d, z: s.z + Math.sin( a ) * d, taken: false, back: 0 } );

		}
		const cMat = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 0.8, 2.4, 3.2 ) } );
		this.crystalMesh = new THREE.InstancedMesh( new THREE.OctahedronGeometry( 0.45 ), cMat, this.crystals.length );
		this.crystalMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.crystalMesh.frustumCulled = false;
		scene.add( this.crystalMesh );

	}

	// rider: the surfer (collisions, close shaves, crystals), or null when on foot
	update( dt, rider ) {

		this.time += dt;
		const sea = this.sea;
		this.spire.position.y = sea.heightAt( this.region.x, this.region.z ) - 30;

		const cam = sea.mesh.position, far = ( x, z ) => this.primed && ( Math.abs( x - cam.x ) > CULL || Math.abs( z - cam.z ) > CULL );
		this.shards.forEach( ( s, i ) => {

			if ( far( s.x, s.z ) ) return; // far from the camera: leave it where it was

			const y = sea.heightAt( s.x, s.z ) - 0.25 * s.scale + Math.sin( this.time * 0.8 + s.phase ) * 0.3;
			_q.setFromEuler( _e.set( s.tilt, s.yaw + this.time * 0.02, s.tilt * 0.5 ) );
			this.mesh.setMatrixAt( i, _m.compose( _p.set( s.x, y, s.z ), _q, _s.setScalar( s.scale ) ) );
			s.y = y;

		} );
		this.mesh.instanceMatrix.needsUpdate = true;

		this.crystals.forEach( ( c, i ) => {

			if ( c.taken && this.time > c.back ) {

				c.taken = false;
				c.dirty = true;

			}
			if ( far( c.x, c.z ) && ! c.dirty ) return;
			c.dirty = false;
			const y = sea.heightAt( c.x, c.z ) + 2;
			let k = c.taken ? 0 : 1;
			if ( ! c.taken && rider && Math.hypot( rider.position.x - c.x, rider.position.z - c.z, rider.position.y + 0.8 - y ) < 3 ) {

				c.taken = true;
				c.back = this.time + RINGS.crystalRespawn;
				k = 0;
				if ( this.onCrystal ) this.onCrystal( new THREE.Vector3( c.x, y, c.z ) );

			}
			_q.setFromEuler( _e.set( 0, this.time * 2 + i, 0 ) );
			this.crystalMesh.setMatrixAt( i, _m.compose( _p.set( c.x, y, c.z ), _q, _s.set( k, k * 1.6, k ) ) );

		} );
		this.crystalMesh.instanceMatrix.needsUpdate = true;
		this.primed = true;

		if ( rider ) this.collide( rider );

	}

	// shards (and the spire) stop the board; passing close at speed is a close shave
	collide( surfer ) {

		const p = surfer.position, v = surfer.velocity;
		const hits = [ ...this.shards, { x: this.region.x, z: this.region.z, scale: 70, y: - 1e9, spire: true } ];
		for ( const s of hits ) {

			const dx = p.x - s.x, dz = p.z - s.z;
			if ( Math.abs( dx ) > 60 || Math.abs( dz ) > 60 ) continue;
			const d = Math.hypot( dx, dz ), r = s.scale * 0.5 + 0.7;
			if ( p.y > s.y + s.scale * 1.6 ) continue; // clear over the top
			if ( d < r && d > 1e-3 ) {

				const nx = dx / d, nz = dz / d;
				p.x += nx * ( r - d );
				p.z += nz * ( r - d );
				const into = v.x * nx + v.z * nz;
				if ( into < 0 ) {

					v.x -= nx * into * 1.3;
					v.z -= nz * into * 1.3;

				}

			} else if ( d < r + RINGS.shaveMargin && surfer.grounded && surfer.speed > RINGS.shaveSpeed && this.time - s.shaved > 3 && ! s.spire ) {

				s.shaved = this.time;
				if ( this.onShave ) this.onShave();

			}

		}

	}

}
