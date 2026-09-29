import * as THREE from 'three/webgpu';
import { uv, vec3, smoothstep, float, length, positionWorld, cameraPosition } from 'three/tsl';
import { COURIER } from './Jobs.js';
import { HARBOR } from '../world/WorldLayout.js';

const COMPASS = [ 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east' ];

// Courier jobs: the dockmaster offers a parcel run; a parcel buoy (teal beacon) appears out at sea;
// ride through it to pick the crate up (it rides on the board), then bring it to the dockmaster's
// mooring before time runs out. update() returns 'picked', 'delivered' or 'failed' on those events.
export class Courier {

	constructor( scene, sea, surfer ) {

		this.sea = sea;
		this.state = 'idle'; // 'idle' | 'fetch' | 'deliver'

		const wood = new THREE.MeshStandardNodeMaterial( { color: 0x7a5230, roughness: 0.8 } );
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		const crateGeo = new THREE.BoxGeometry( 0.9, 0.7, 0.9 );

		// the parcel buoy: a crate on a brass float with a teal beacon
		this.buoy = new THREE.Group();
		const float_ = new THREE.Mesh( new THREE.CylinderGeometry( 1.2, 1.4, 0.5, 16 ), brass );
		const crate = new THREE.Mesh( crateGeo, wood );
		crate.position.y = 0.6;
		const beamMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } );
		const near = smoothstep( 20, 120, length( positionWorld.xz.sub( cameraPosition.xz ) ) );
		beamMat.colorNode = vec3( 0.1, 0.55, 0.6 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( near.mul( 0.8 ).add( 0.2 ) );
		const beamGeo = new THREE.CylinderGeometry( 1.0, 1.0, 90, 12, 1, true );
		beamGeo.translate( 0, 45, 0 );
		this.buoy.add( float_, crate, new THREE.Mesh( beamGeo, beamMat ) );
		this.buoy.visible = false;
		scene.add( this.buoy );

		// the crate strapped behind the rider while delivering
		this.carried = new THREE.Mesh( crateGeo, wood );
		this.carried.scale.setScalar( 0.6 );
		this.carried.position.set( 0, 0.4, - 0.95 );
		this.carried.visible = false;
		surfer.object.add( this.carried );

	}

	// a fresh offer: where, how far, how long, how much
	makeOffer() {

		const C = COURIER;
		const a = Math.random() * Math.PI * 2;
		const dist = C.minDistance + Math.random() * ( C.maxDistance - C.minDistance );
		const pay = Math.round( ( C.basePay + dist * C.payPerMetre ) / 5 ) * 5;
		const time = Math.round( C.timeBase + dist * 2 * C.timePerMetre );
		// compass: +x east, -z north
		const heading = COMPASS[ ( ( Math.round( a / ( Math.PI / 4 ) ) % 8 ) + 8 ) % 8 ];
		this.offer = { x: HARBOR.x + Math.cos( a ) * dist, z: HARBOR.z + Math.sin( a ) * dist, dist: Math.round( dist ), pay, time, heading };
		return this.offer;

	}

	accept() {

		this.job = this.offer;
		this.state = 'fetch';
		this.timeLeft = this.job.time;
		this.buoy.position.set( this.job.x, 0, this.job.z );
		this.buoy.visible = true;

	}

	abandon() {

		this.state = 'idle';
		this.buoy.visible = false;
		this.carried.visible = false;

	}

	// dropoff: the dockmaster's mooring position; atDropoff( pos ) says if the board is there
	update( dt, surfer, atDropoff ) {

		if ( this.state === 'idle' ) return null;
		this.timeLeft -= dt;
		if ( this.timeLeft <= 0 ) {

			this.abandon();
			return 'failed';

		}

		const b = this.buoy.position;
		b.y = this.sea.heightAt( b.x, b.z ) - 0.1;
		this.buoy.rotation.y += dt * 0.5;

		if ( this.state === 'fetch' ) {

			const p = surfer.position;
			if ( Math.hypot( p.x - b.x, p.z - b.z ) < COURIER.pickupRadius && Math.abs( p.y - b.y ) < 4 ) {

				this.state = 'deliver';
				this.buoy.visible = false;
				this.carried.visible = true;
				return 'picked';

			}

		} else if ( atDropoff( surfer.position ) ) {

			this.payout = this.job.pay + ( this.timeLeft > this.job.time / 2 ? Math.round( this.job.pay * COURIER.quickBonus ) : 0 );
			this.abandon();
			return 'delivered';

		}
		return null;

	}

	// what the HUD objective should point at
	get target() {

		if ( this.state === 'fetch' ) return { label: 'Parcel', x: this.buoy.position.x, z: this.buoy.position.z };
		if ( this.state === 'deliver' ) return { label: 'Deliver to the dockmaster', x: this.dropoff.x, z: this.dropoff.z };
		return null;

	}

}
