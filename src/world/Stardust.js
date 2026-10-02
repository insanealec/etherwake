import * as THREE from 'three/webgpu';
import { uv, vec3, smoothstep, float, length, positionWorld, cameraPosition } from 'three/tsl';
import { STARDUST } from '../game/Rewards.js';
import { HARBOR } from './WorldLayout.js';

// seeded random, so the trails are in the same places every session
function mulberry32( a ) {

	return () => {

		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul( a ^ a >>> 15, 1 | a );
		t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t;
		return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;

	};

}

const CULL = 700; // metres: only trails this near the camera bob on the swell each frame
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

// Stardust: trails of glowing motes riding the swell out on the open sea. Some trails arc high over a
// crest, so you need a jump to sweep them. Each trail has a faint light pillar so you can find it from
// afar. Collected trails come back after a while. onCollect( credits, trailComplete ) reports pickups.
export class Stardust {

	constructor( scene, sea ) {

		this.sea = sea;
		this.onCollect = null;
		const S = STARDUST, rand = mulberry32( 1337 );

		this.trails = [];
		for ( let t = 0; t < S.trails; t ++ ) {

			const a = rand() * Math.PI * 2, r = S.minRadius + rand() * ( S.maxRadius - S.minRadius );
			const cx = HARBOR.x + Math.cos( a ) * r, cz = HARBOR.z + Math.sin( a ) * r;
			const dir = Math.PI / 2 + ( rand() - 0.5 ) * 1.2; // mostly along the crests
			const arc = rand() < S.arcChance;
			const motes = [];
			for ( let i = 0; i < S.perTrail; i ++ ) {

				const u = i / ( S.perTrail - 1 ) - 0.5;
				motes.push( {
					x: cx + Math.cos( dir ) * u * S.spacing * S.perTrail,
					z: cz + Math.sin( dir ) * u * S.spacing * S.perTrail,
					lift: 1.2 + ( arc ? S.arcHeight * Math.cos( u * Math.PI ) : 0 ),
					taken: false
				} );

			}
			this.trails.push( { cx, cz, motes, left: S.perTrail, respawnAt: 0 } );

		}

		const count = S.trails * S.perTrail;
		const moteMat = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 2.6, 1.7, 0.55 ) } );
		this.motes = new THREE.InstancedMesh( new THREE.OctahedronGeometry( 0.35 ), moteMat, count );
		this.motes.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.motes.frustumCulled = false;

		// light pillars: fading upward and near the camera (they're for finding trails from afar)
		const pillarMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } );
		const near = smoothstep( 25, 140, length( positionWorld.xz.sub( cameraPosition.xz ) ) ); // fade out up close
		pillarMat.colorNode = vec3( 0.5, 0.33, 0.1 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( near ).mul( 0.6 );
		const pillarGeo = new THREE.CylinderGeometry( 0.8, 0.8, 60, 12, 1, true );
		pillarGeo.translate( 0, 30, 0 );
		this.pillars = new THREE.InstancedMesh( pillarGeo, pillarMat, S.trails );
		this.pillars.frustumCulled = false;

		scene.add( this.motes, this.pillars );
		this.time = 0;

	}

	update( dt, surfer ) {

		this.time += dt;
		const S = STARDUST, sea = this.sea, p = surfer.position, cam = sea.mesh.position;
		let i = 0;
		this.trails.forEach( ( tr, t ) => {

			if ( tr.left === 0 && this.time >= tr.respawnAt ) {

				for ( const m of tr.motes ) m.taken = false;
				tr.left = S.perTrail;
				tr.dirty = true;

			}

			// far from the camera: leave them where they were (after the first full pass)
			if ( this.primed && ! tr.dirty && ( Math.abs( tr.cx - cam.x ) > CULL || Math.abs( tr.cz - cam.z ) > CULL ) ) {

				i += tr.motes.length;
				return;

			}
			tr.dirty = false;

			const near = Math.hypot( tr.cx - p.x, tr.cz - p.z ) < S.spacing * S.perTrail;
			for ( const m of tr.motes ) {

				if ( m.taken ) {

					this.motes.setMatrixAt( i ++, _m.makeScale( 0, 0, 0 ) );
					continue;

				}
				_p.set( m.x, sea.heightAt( m.x, m.z ) + m.lift, m.z );
				if ( near && _p.distanceTo( _s.set( p.x, p.y + 0.8, p.z ) ) < S.pickupRadius ) {

					m.taken = true;
					tr.left --;
					if ( tr.left === 0 ) tr.respawnAt = this.time + S.respawn;
					if ( this.onCollect ) this.onCollect( _p.clone(), tr.left === 0 );

				}
				_q.setFromEuler( _e.set( this.time * 1.5, this.time * 2 + i, 0 ) );
				const k = m.taken ? 0 : 1;
				this.motes.setMatrixAt( i ++, _m.compose( _p, _q, _s.set( k, k, k ) ) );

			}

			// pillar at the trail centre while anything is left
			const k = tr.left > 0 ? 1 : 0;
			_p.set( tr.cx, sea.heightAt( tr.cx, tr.cz ), tr.cz );
			this.pillars.setMatrixAt( t, _m.compose( _p, _q.identity(), _s.set( k, k, k ) ) );

		} );
		this.primed = true;
		this.motes.instanceMatrix.needsUpdate = true;
		this.pillars.instanceMatrix.needsUpdate = true;

	}

}
