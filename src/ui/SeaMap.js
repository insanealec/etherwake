// The sea chart (Tab): a parchment-dark map of the known sea, north up. Regions as tinted circles with
// names, the harbour, the galleon, the whale pod, and an arrow for you. Drawn on a canvas while open.
const SIZE = 440; // px
const REACH = 6000; // metres from the harbour shown to the edge

export class SeaMap {

	constructor() {

		this.el = document.getElementById( 'seamap' );
		this.canvas = this.el.querySelector( 'canvas' );
		this.canvas.width = this.canvas.height = SIZE * devicePixelRatio;
		this.canvas.style.width = this.canvas.style.height = SIZE + 'px';
		this.ctx = this.canvas.getContext( '2d' );
		this.open = false;

	}

	toggle() {

		this.open = ! this.open;
		this.el.classList.toggle( 'open', this.open );

	}

	// state: { regions: [ { name, x, z, radius, color } ], places: [ { name, icon, color, x, z } ],
	// pod: { x, z } | null, player: { x, z, heading } } (heading: degrees clockwise from north)
	draw( { regions, places, pod, player } ) {

		if ( ! this.open ) return;
		const c = this.ctx, k = devicePixelRatio, s = SIZE / 2 / REACH;
		const X = ( x ) => ( SIZE / 2 + x * s ) * k, Y = ( z ) => ( SIZE / 2 + z * s ) * k;
		c.setTransform( 1, 0, 0, 1, 0, 0 );
		c.clearRect( 0, 0, SIZE * k, SIZE * k );

		// the chart: a dark round sea with range rings every 2 km
		c.fillStyle = 'rgba( 16, 10, 28, 0.88 )';
		c.beginPath();
		c.arc( X( 0 ), Y( 0 ), ( SIZE / 2 - 2 ) * k, 0, Math.PI * 2 );
		c.fill();
		c.strokeStyle = 'rgba( 184, 134, 59, 0.35 )';
		c.lineWidth = k;
		for ( let r = 2000; r <= REACH; r += 2000 ) {

			c.beginPath();
			c.arc( X( 0 ), Y( 0 ), r * s * k, 0, Math.PI * 2 );
			c.stroke();

		}
		c.font = `${ 13 * k }px Georgia, serif`;
		c.textAlign = 'center';
		c.fillStyle = 'rgba( 243, 230, 196, 0.8 )';
		c.fillText( 'N', X( 0 ), 16 * k );

		for ( const r of regions ) {

			c.fillStyle = r.color + '33';
			c.strokeStyle = r.color;
			c.beginPath();
			c.arc( X( r.x ), Y( r.z ), r.radius * s * k, 0, Math.PI * 2 );
			c.fill();
			c.stroke();
			c.fillStyle = r.color;
			c.fillText( r.name, X( r.x ), Y( r.z ) + 4 * k );

		}
		for ( const p of places ) {

			c.fillStyle = p.color;
			c.fillText( p.icon, X( p.x ), Y( p.z ) + 5 * k );

		}
		if ( pod ) {

			c.fillStyle = '#7fe3ff';
			c.fillText( '≈', X( pod.x ), Y( pod.z ) + 5 * k );

		}

		// you: an arrow pointing along your heading
		const a = player.heading * Math.PI / 180;
		c.save();
		c.translate( X( player.x ), Y( player.z ) );
		c.rotate( a );
		c.fillStyle = '#ffd08a';
		c.beginPath();
		c.moveTo( 0, - 9 * k );
		c.lineTo( 6 * k, 7 * k );
		c.lineTo( 0, 3 * k );
		c.lineTo( - 6 * k, 7 * k );
		c.closePath();
		c.fill();
		c.restore();

	}

}
