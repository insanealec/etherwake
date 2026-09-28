import { buildFigure } from '../player/Figure.js';
import { CHARACTERS } from '../game/Characters.js';
import { DECK_Y } from './Port.js';

const TALK_RANGE = 2.8;

// Port characters standing at their shack doors. They idle (a gentle sway) and turn to face the
// walker when near. nearest() finds who you can talk to.
export class Npcs {

	constructor( scene, port ) {

		this.list = CHARACTERS.map( ( c ) => {

			const shack = port.shacks[ c.shack ];
			const fig = buildFigure( { coat: c.coat, hat: c.hat, skin: 0xb98060 } );
			fig.position.set( shack.door.x, DECK_Y + 0.5, shack.door.z );
			fig.rotation.y = shack.facing;
			scene.add( fig );
			return { ...c, fig, home: shack.facing };

		} );
		this.time = 0;

	}

	nearest( pos ) {

		let best = null, bestD = TALK_RANGE;
		for ( const n of this.list ) {

			const d = Math.hypot( n.fig.position.x - pos.x, n.fig.position.z - pos.z );
			if ( d < bestD ) {

				best = n;
				bestD = d;

			}

		}
		return best;

	}

	update( dt, walkerPos ) {

		this.time += dt;
		this.list.forEach( ( n, i ) => {

			// face the walker when close, otherwise drift back to looking out to sea
			const dx = walkerPos ? walkerPos.x - n.fig.position.x : 0, dz = walkerPos ? walkerPos.z - n.fig.position.z : 0;
			const want = walkerPos && Math.hypot( dx, dz ) < 8 ? Math.atan2( dx, dz ) : n.home;
			const diff = Math.atan2( Math.sin( want - n.fig.rotation.y ), Math.cos( want - n.fig.rotation.y ) );
			n.fig.rotation.y += diff * ( 1 - Math.exp( - 4 * dt ) );
			n.fig.rotation.z = Math.sin( this.time * 1.3 + i * 2 ) * 0.03;

		} );

	}

}
