import * as THREE from 'three/webgpu';
import { buildFigure } from '../player/Figure.js';
import { CHARACTERS } from '../game/Characters.js';
import { DECK_Y } from './Port.js';

const TALK_RANGE = 2.8; // on foot
const MOORING_RANGE = 7; // on the board, from the mooring buoy

// Port characters standing at the boardwalk's outer edge by their shacks. Each has a glowing mooring
// buoy on the water in front, so you can talk from the board without docking. They idle (a gentle
// sway) and turn to face you when near.
export class Npcs {

	constructor( scene, port, sea ) {

		this.sea = sea;
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		const glow = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 3.0, 1.5, 0.5 ) } );
		const postGeo = new THREE.CylinderGeometry( 0.07, 0.09, 1.8, 8 );
		postGeo.translate( 0, 0.9, 0 );
		const floatGeo = new THREE.TorusGeometry( 0.45, 0.12, 8, 20 );
		floatGeo.rotateX( Math.PI / 2 );
		const lampGeo = new THREE.SphereGeometry( 0.2, 12, 8 );
		lampGeo.translate( 0, 1.9, 0 );

		this.list = CHARACTERS.map( ( c ) => {

			const shack = port.shacks[ c.shack ];
			const fig = buildFigure( { coat: c.coat, hat: c.hat, skin: 0xb98060 } );
			fig.position.set( shack.door.x, DECK_Y + 0.5, shack.door.z );
			fig.rotation.y = shack.facing;
			scene.add( fig );

			const buoy = new THREE.Group();
			buoy.add( new THREE.Mesh( postGeo, brass ), new THREE.Mesh( floatGeo, brass ), new THREE.Mesh( lampGeo, glow ) );
			buoy.position.set( shack.mooring.x, 0, shack.mooring.z );
			scene.add( buoy );

			return { ...c, fig, buoy, home: shack.facing };

		} );
		this.time = 0;

	}

	// who you can talk to on foot
	nearest( pos ) {

		return this.closest( pos, ( n ) => n.fig.position, TALK_RANGE );

	}

	// who you can talk to from the board (near their mooring buoy)
	nearestMooring( pos ) {

		return this.closest( pos, ( n ) => n.buoy.position, MOORING_RANGE );

	}

	closest( pos, where, range ) {

		let best = null, bestD = range;
		for ( const n of this.list ) {

			const p = where( n );
			const d = Math.hypot( p.x - pos.x, p.z - pos.z );
			if ( d < bestD ) {

				best = n;
				bestD = d;

			}

		}
		return best;

	}

	// lookAt: the walker's or the board's position (NPCs face it when close)
	update( dt, lookAt ) {

		this.time += dt;
		this.list.forEach( ( n, i ) => {

			const dx = lookAt.x - n.fig.position.x, dz = lookAt.z - n.fig.position.z;
			const want = Math.hypot( dx, dz ) < 12 ? Math.atan2( dx, dz ) : n.home;
			const diff = Math.atan2( Math.sin( want - n.fig.rotation.y ), Math.cos( want - n.fig.rotation.y ) );
			n.fig.rotation.y += diff * ( 1 - Math.exp( - 4 * dt ) );
			n.fig.rotation.z = Math.sin( this.time * 1.3 + i * 2 ) * 0.03;

			// the buoy bobs on the swell with a slight tilt
			const b = n.buoy.position;
			b.y = this.sea.heightAt( b.x, b.z ) - 0.1;
			n.buoy.rotation.set( Math.sin( this.time * 1.7 + i ) * 0.08, 0, Math.cos( this.time * 1.3 + i ) * 0.08 );

		} );

	}

}
