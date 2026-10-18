import * as THREE from 'three/webgpu';
import { RING_OUT, DECK_Y } from '../world/Port.js';

// Grinds (tricks, slice 2): hold L in the air near a rail to lock on and slide along it. A balance meter
// wobbles (gently at first, then steadily); A/D counter it, and past the edge you bail. Space pops you off
// into the air (the combo goes on); the end of a rail launches you. A grind scores by its length and
// joins the combo like any trick (game/Tricks.js).
export const GRIND = {
	capture: 1.8, // metres from the rail (sideways) to lock on
	above: 1.8, below: 0.9, // how far above / below the rail the board may be
	minSpeed: 5, // m/s along the rail to lock on (and the slowest you'll slide)
	friction: 0.04, // speed lost per second (fraction)
	points: 100, perSecond: 140,
	wobble: 0.75, // how hard the balance drifts (steady: long grinds shouldn't get harder)
	easeIn: 1.0, // seconds for the wobble to ease in at the start (time to settle onto the rail)
	lean: 0.35, // extra drift the further the needle already leans (keep small, or it runs away)
	flips: 0.3, // chance per second that the drift changes direction
	counter: 3.0, // how strongly A/D push the balance back
	pop: 7, // upward speed when you jump off
	endPop: 3.5 // upward speed off the end of a rail
};

// The rail park: floating brass rails in the calm water east of the harbour, where you set out (all
// within the harbour calm, ~140 m, so swells don't swamp them). Points are world [ x, y, z ] (y above the
// calm surface), joined by straight runs.
export const RAIL_PARK = [
	{ name: 'Brass Rail', points: [ [ 85, 2.6, - 8 ], [ 130, 2.6, - 8 ] ] },
	{ name: 'Brass Rail', points: [ [ 82, 2.2, 16 ], [ 105, 3.4, 18 ], [ 128, 2.2, 20 ] ] }, // a hump
	{ name: 'Comet Arc', points: arc( 95, - 36, 22, - 0.6, 1.4, 14, 2.4, 3.6 ) },
	{ name: 'Long Spine', points: [ [ 60, 2.4, 48 ], [ 90, 3.0, 60 ], [ 120, 3.2, 52 ], [ 132, 2.6, 30 ] ] }
];

// points round a circle: centre ( cx, cz ), radius r, from a0 to a1 (radians), n segments, heights from
// y0 at the ends to y1 at the middle
function arc( cx, cz, r, a0, a1, n, y0, y1 ) {

	const pts = [];
	for ( let i = 0; i <= n; i ++ ) {

		const k = i / n, a = a0 + ( a1 - a0 ) * k;
		pts.push( [ cx + Math.cos( a ) * r, y0 + ( y1 - y0 ) * Math.sin( Math.PI * k ), cz + Math.sin( a ) * r ] );

	}
	return pts;

}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3();

export class Grinds {

	// galleon: its cap rails (ship coordinates, `grindRails`) are grindable as the ship moves
	constructor( scene, galleon ) {

		this.galleon = galleon;
		this.rails = [];
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xc8963f, metalness: 0.9, roughness: 0.3 } );
		const glow = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 2.6, 1.4, 0.5 ) } );
		for ( const r of RAIL_PARK ) {

			const pts = r.points.map( ( [ x, y, z ] ) => new THREE.Vector3( x, y, z ) );
			this.rails.push( { name: r.name, pts } );
			// a brass tube on posts down into the cloud, glowing caps at the ends
			const path = new THREE.CurvePath();
			for ( let i = 1; i < pts.length; i ++ ) path.add( new THREE.LineCurve3( pts[ i - 1 ], pts[ i ] ) );
			scene.add( new THREE.Mesh( new THREE.TubeGeometry( path, pts.length * 24, 0.09, 8 ), brass ) );
			const len = path.getLength();
			for ( let s = 0; s <= len; s += 8 ) {

				const p = path.getPointAt( Math.min( 1, s / len ) );
				const post = new THREE.Mesh( new THREE.CylinderGeometry( 0.05, 0.07, p.y + 3, 6 ), brass );
				post.position.set( p.x, ( p.y - 3 ) / 2, p.z );
				scene.add( post );

			}
			for ( const e of [ pts[ 0 ], pts[ pts.length - 1 ] ] ) {

				const cap = new THREE.Mesh( new THREE.SphereGeometry( 0.16, 10, 8 ), glow );
				cap.position.copy( e );
				scene.add( cap );

			}

		}
		// the boardwalk railing, just inside the lantern posts
		const ring = [];
		for ( let i = 0; i <= 64; i ++ ) {

			const a = i / 64 * Math.PI * 2, r = RING_OUT - 0.25;
			ring.push( new THREE.Vector3( Math.cos( a ) * r, DECK_Y + 1.0, Math.sin( a ) * r ) );

		}
		this.rails.push( { name: 'Boardwalk Rail', pts: ring, loop: true } );
		scene.add( new THREE.Mesh( new THREE.TubeGeometry( new THREE.CatmullRomCurve3( ring, true ), 256, 0.06, 6, true ), brass ) );

		this.state = null; // { rail, seg, u, dir, speed, time, balance, drift }
		this.shipPts = [];

	}

	// the rails in world space this frame (the galleon's move with it)
	railsNow() {

		const out = this.rails.slice();
		const g = this.galleon;
		if ( g?.grindRails ) {

			g.group.updateMatrixWorld();
			g.grindRails.forEach( ( local, i ) => {

				const pts = this.shipPts[ i ] || ( this.shipPts[ i ] = local.map( () => new THREE.Vector3() ) );
				local.forEach( ( p, j ) => pts[ j ].copy( p ).applyMatrix4( g.group.matrixWorld ) );
				out.push( { name: 'Galleon Rail', pts, ship: true } );

			} );

		}
		return out;

	}

	// closest point of a rail polyline to p: { seg, u, point, dist (sideways), dy }
	closest( rail, p ) {

		let best = null;
		const n = rail.pts.length - 1;
		for ( let i = 0; i < n; i ++ ) {

			_a.copy( rail.pts[ i ] );
			_b.copy( rail.pts[ i + 1 ] );
			_d.subVectors( _b, _a );
			const len2 = _d.lengthSq();
			const u = Math.max( 0, Math.min( 1, _q.subVectors( p, _a ).dot( _d ) / len2 ) );
			const point = _a.clone().addScaledVector( _d, u );
			const dist = Math.hypot( p.x - point.x, p.z - point.z );
			if ( ! best || dist < best.dist ) best = { seg: i, u, point, dist, dy: p.y - point.y };

		}
		return best;

	}

	// try to lock on (surfer airborne, L held). Returns true when a grind starts.
	tryStart( surfer ) {

		if ( this.state || surfer.grounded || surfer.wipeout > 0 ) return false;
		const p = surfer.position, v = surfer.velocity;
		for ( const rail of this.railsNow() ) {

			const c = this.closest( rail, p );
			if ( c.dist > GRIND.capture || c.dy > GRIND.above || c.dy < - GRIND.below ) continue;
			_d.subVectors( rail.pts[ c.seg + 1 ], rail.pts[ c.seg ] ).normalize();
			const along = v.x * _d.x + v.z * _d.z;
			const horiz = Math.hypot( v.x, v.z );
			if ( horiz < GRIND.minSpeed * 0.6 || Math.abs( along ) < horiz * 0.35 ) continue;
			this.state = {
				rail, seg: c.seg, u: c.u, dir: Math.sign( along ) || 1, speed: Math.max( GRIND.minSpeed, Math.abs( along ) ),
				time: 0, balance: 0, drift: ( Math.random() < 0.5 ? - 1 : 1 )
			};
			return true;

		}
		return false;

	}

	// while grinding: slide, balance, and report how it ended.
	// steer: -1..1 (A/D); jump: pressed. Returns null while grinding, else { end: 'jump' | 'end' | 'bail', name, time }
	update( dt, surfer, steer, jump ) {

		const S = this.state;
		if ( ! S ) return null;
		// the galleon's rails move: refresh this rail's world points
		if ( S.rail.ship ) this.railsNow();
		const pts = S.rail.pts, n = pts.length - 1;
		S.time += dt;
		S.speed = Math.max( GRIND.minSpeed, S.speed * ( 1 - GRIND.friction * dt ) );

		// balance: drifts one way (now and then the other), easing in over the first second; A/D push the
		// needle left/right. Steady over time, so a long grind is a reward, not a trap
		const wobble = GRIND.wobble * Math.min( 1, S.time / GRIND.easeIn );
		if ( Math.random() < dt * GRIND.flips ) S.drift = - S.drift;
		S.balance += ( S.drift * wobble * ( 1 + GRIND.lean * Math.abs( S.balance ) ) + steer * GRIND.counter ) * dt;

		// slide along the polyline
		let dist = S.speed * dt;
		let ended = false;
		while ( dist > 0 && ! ended ) {

			_d.subVectors( pts[ S.seg + 1 ], pts[ S.seg ] );
			const len = _d.length();
			const room = ( S.dir > 0 ? 1 - S.u : S.u ) * len;
			if ( dist < room ) {

				S.u += S.dir * dist / len;
				dist = 0;

			} else {

				dist -= room;
				const next = S.seg + S.dir;
				if ( next >= 0 && next < n ) {

					S.seg = next;
					S.u = S.dir > 0 ? 0 : 1;

				} else if ( S.rail.loop ) {

					S.seg = S.dir > 0 ? 0 : n - 1;
					S.u = S.dir > 0 ? 0 : 1;

				} else {

					S.u = S.dir > 0 ? 1 : 0;
					ended = true;

				}

			}

		}
		_a.copy( pts[ S.seg ] ).lerp( pts[ S.seg + 1 ], S.u );
		_d.subVectors( pts[ S.seg + 1 ], pts[ S.seg ] ).normalize().multiplyScalar( S.dir );
		surfer.position.set( _a.x, _a.y + 0.12, _a.z );
		surfer.velocity.copy( _d ).multiplyScalar( S.speed );
		surfer.yaw = Math.atan2( _d.x, _d.z );

		let end = null;
		if ( Math.abs( S.balance ) > 1 ) end = 'bail';
		else if ( jump ) end = 'jump';
		else if ( ended ) end = 'end';
		if ( ! end ) return null;
		this.state = null;
		if ( end === 'jump' ) surfer.velocity.y = GRIND.pop;
		else if ( end === 'end' ) surfer.velocity.y += GRIND.endPop;
		else {

			// bail: off the side, tumbling
			surfer.velocity.set( _d.z * 3, 0, - _d.x * 3 );

		}
		return { end, name: S.rail.name, time: S.time };

	}

	get balance() {

		return this.state ? this.state.balance : 0;

	}

}
