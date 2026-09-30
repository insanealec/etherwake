// Compass strip across the top of the screen: cardinal points and ticks for the camera's heading, and
// markers for places ( { name, icon, color, x, z } ) with distances. North is -z, east is +x.
const SPAN = 200; // degrees shown across the strip
const WIDTH = 460; // px

const CARDINALS = [ [ 0, 'N' ], [ 45, 'NE' ], [ 90, 'E' ], [ 135, 'SE' ], [ 180, 'S' ], [ 225, 'SW' ], [ 270, 'W' ], [ 315, 'NW' ] ];

export class Compass {

	constructor() {

		this.el = document.getElementById( 'compass' );
		this.ticks = [];
		for ( let d = 0; d < 360; d += 15 ) {

			const t = document.createElement( 'div' );
			const card = CARDINALS.find( ( [ a ] ) => a === d );
			t.className = card ? 'tick card' : 'tick';
			t.textContent = card ? card[ 1 ] : '';
			this.el.appendChild( t );
			this.ticks.push( { d, el: t } );

		}
		this.markers = new Map();

	}

	// heading: degrees clockwise from north; places: [ { name, icon, color, x, z } ]; from: { x, z }
	update( heading, places, from ) {

		const at = ( deg ) => {

			const diff = ( ( deg - heading + 540 ) % 360 ) - 180;
			return { diff, x: diff / SPAN * WIDTH };

		};
		for ( const t of this.ticks ) {

			const { diff, x } = at( t.d );
			t.el.style.transform = `translateX( ${ x.toFixed( 1 ) }px )`;
			t.el.style.opacity = Math.abs( diff ) < SPAN / 2 ? 1 - Math.abs( diff ) / ( SPAN / 2 ) * 0.6 : 0;

		}

		for ( const p of places ) {

			let m = this.markers.get( p.name );
			if ( ! m ) {

				m = document.createElement( 'div' );
				m.className = 'marker';
				m.style.color = p.color;
				this.el.appendChild( m );
				this.markers.set( p.name, m );

			}
			const dx = p.x - from.x, dz = p.z - from.z, dist = Math.hypot( dx, dz );
			const bearing = ( Math.atan2( dx, - dz ) * 180 / Math.PI + 360 ) % 360;
			const { diff } = at( bearing );
			// off the strip: pin to the edge, dimmed
			const clamped = Math.max( - SPAN / 2, Math.min( SPAN / 2, diff ) );
			const edge = clamped !== diff;
			const label = dist > 1000 ? `${ ( dist / 1000 ).toFixed( 1 ) } km` : `${ Math.round( dist ) } m`;
			const text = `${ p.icon } ${ Math.abs( diff ) < 20 ? `${ p.name } · ${ label }` : label }`;
			if ( m.textContent !== text ) m.textContent = text;
			m.style.transform = `translateX( calc( ${ ( clamped / SPAN * WIDTH ).toFixed( 1 ) }px - 50% ) )`;
			m.style.opacity = edge ? 0.35 : 1;

		}

	}

}
