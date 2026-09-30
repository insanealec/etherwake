import * as THREE from 'three/webgpu';
import { uv, vec3, float, smoothstep, length, positionWorld, cameraPosition, mx_noise_float } from 'three/tsl';
import { REGIONS } from './WorldLayout.js';
import { FLARES, FLARE_TINT, REACH } from '../game/Flares.js';
import { RINGS } from '../game/Rings.js';
import { RIM } from '../game/Rim.js';
import { setFlareRegion, setFlare, FRONTS } from '../sea/Etherium.js';
import { uSunBoost } from '../sky/Starfield.js';

const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Regions (milestone 8). The Flare Reach: its atmosphere blends in as you approach (warmer fog and
// sea, taller swell), a flickering ember column marks it from afar, and every FLARES.period seconds the
// star flares: the sun pulses (warning), then a flare-front rolls across the Reach away from the sun
// (up to FRONTS at once). Each front carries a cluster of sunstones along its crest, placed around the
// player. Every region (the Flare Reach, the Ring Reach) blends its own fog and sea tint in as you
// approach and pays its multiplier inside. update() returns an event ( { type: 'enter' | 'leave' |
// 'warning' | 'launch', name } ) or null; onSunstone( position ) reports pickups.
export class Regions {

	constructor( scene, sea ) {

		this.sea = sea;
		this.onSunstone = null;
		const R = this.flare = REGIONS.flare;
		const l = Math.hypot( ...R.dir );
		this.dir = [ R.dir[ 0 ] / l, R.dir[ 1 ] / l ];
		setFlareRegion( R.x, R.z, this.dir[ 0 ], this.dir[ 1 ], R.radius, R.swell );
		this.clock = FLARES.period - 20; // the first flare ~20 s after starting
		// every region's atmosphere and pay
		this.list = [
			{ ...REGIONS.flare, tint: FLARE_TINT, multiplier: REACH.multiplier, inside: false, mix: 0 },
			{ ...REGIONS.rings, tint: RINGS.tint, multiplier: RINGS.multiplier, inside: false, mix: 0 },
			{ ...REGIONS.rim, tint: RIM.tint, multiplier: RIM.multiplier, inside: false, mix: 0 }
		];
		this.flareRegion = this.list[ 0 ];
		this.active = null; // the region you're inside
		this.fronts = Array.from( { length: FRONTS }, () => ( { age: - 1, stones: [] } ) );

		// the ember column: tall, soft-edged, flickering, visible through the haze, faded up close
		const mat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false } );
		const flicker = mx_noise_float( vec3( uv().x.mul( 6 ), uv().y.mul( 3 ).sub( sea.uTime.mul( 0.4 ) ), sea.uTime.mul( 0.3 ) ) ).mul( 0.35 ).add( 0.75 );
		const near = smoothstep( 300, 1400, length( positionWorld.xz.sub( cameraPosition.xz ) ) );
		mat.colorNode = vec3( 0.5, 0.16, 0.03 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( flicker ).mul( near );
		const geo = new THREE.CylinderGeometry( 30, 45, 900, 24, 1, true );
		geo.translate( 0, 450, 0 );
		this.column = new THREE.Mesh( geo, mat );
		this.column.position.set( R.x, - 20, R.z );
		this.column.frustumCulled = false;
		scene.add( this.column );

		// sunstones: big rose-gold gems riding the fronts
		const gem = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 3.2, 1.3, 0.7 ) } );
		this.gems = new THREE.InstancedMesh( new THREE.OctahedronGeometry( 0.8 ), gem, FRONTS * FLARES.sunstones );
		this.gems.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.gems.frustumCulled = false;
		scene.add( this.gems );
		this.time = 0;

	}

	get inReach() {

		return !! this.active;

	}

	// the pay multiplier where you are
	get multiplier() {

		return this.active ? this.active.multiplier : 1;

	}

	launch( front, focus ) {

		const R = this.flare, [ dx, dz ] = this.dir;
		front.age = 0;
		// a cluster of sunstones along the crest, centred on the player's line (else the middle)
		const lx = focus.x - R.x, lz = focus.z - R.z;
		const across = this.flareRegion.inside ? - lx * dz + lz * dx : 0;
		front.stones = [];
		for ( let i = 0; i < FLARES.sunstones; i ++ ) front.stones.push( { v: across + ( i - ( FLARES.sunstones - 1 ) / 2 ) * 28, taken: false } );

	}

	// focus: where the player is (the camera); rider: the surfer (collects sunstones)
	update( dt, focus, rider ) {

		this.time += dt;
		const R = this.flare, F = FLARES, [ dx, dz ] = this.dir;

		// each region's atmosphere blends in with distance; the strongest one tints the sea and fog
		let event = null, top = null;
		for ( const g of this.list ) {

			const d = Math.hypot( focus.x - g.x, focus.z - g.z );
			g.mix = smooth( g.radius * 1.2, g.radius * 0.85, d );
			if ( ! top || g.mix > top.mix ) top = g;
			if ( ! g.inside && d < g.radius ) {

				g.inside = true;
				this.active = g;
				event = { type: 'enter', name: g.name };

			} else if ( g.inside && d > g.radius * 1.1 ) {

				g.inside = false;
				if ( this.active === g ) this.active = null;
				event = { type: 'leave', name: g.name };

			}

		}
		this.sea.regionMix = top.mix;
		this.sea.regionFog.setRGB( ...top.tint.fog );
		this.sea.uRegionSea.value.setRGB( ...top.tint.sea );
		this.sea.uRegionRecolor.value = top.tint.recolor ?? 0;
		const mix = this.flareRegion.mix;

		// the flare cycle: a warning, then a new front launches from the sunward edge
		const prev = this.clock % F.period;
		this.clock += dt;
		const t = this.clock % F.period;
		let boost = 0;
		if ( t < F.warn ) {

			if ( prev >= F.warn && mix > 0.2 && ! event ) event = { type: 'warning' };
			boost = ( 0.6 + 0.6 * Math.sin( this.clock * 7 ) ) * ( t / F.warn );

		} else if ( prev < F.warn ) {

			const free = this.fronts.find( ( f ) => f.age < 0 );
			if ( free ) {

				this.launch( free, focus );
				if ( mix > 0.2 && ! event ) event = { type: 'launch' };

			}

		}

		// fronts roll across; their sunstones ride the crest
		const travel = 1.8 * R.radius / F.speed;
		let n = 0;
		this.fronts.forEach( ( f, i ) => {

			if ( f.age >= 0 ) {

				f.age += dt;
				boost = Math.max( boost, 2 * Math.max( 0, 1 - f.age / 4 ) );
				if ( f.age > travel ) f.age = - 1;

			}
			const alive = f.age >= 0;
			const s = - 0.9 * R.radius + ( alive ? f.age : 0 ) * F.speed;
			const H = alive ? F.height * smooth( 0, 3, f.age ) * smooth( travel, travel - 6, f.age ) : 0;
			setFlare( i, s, H );

			for ( const st of f.stones ) {

				const x = R.x + dx * s - dz * st.v, z = R.z + dz * s + dx * st.v;
				const inside = Math.hypot( x - R.x, z - R.z ) < R.radius * 0.9;
				let k = 0;
				if ( alive && ! st.taken && inside && H > 2 ) {

					_p.set( x, this.sea.heightAt( x, z ) + F.sunstoneLift, z );
					if ( rider && _p.distanceTo( _s.set( rider.x, rider.y + 0.8, rider.z ) ) < F.sunstoneRadius ) {

						st.taken = true;
						if ( this.onSunstone ) this.onSunstone( _p.clone() );

					} else k = 1;

				}
				_q.setFromAxisAngle( _s.set( 0, 1, 0 ), this.time * 2 + st.v );
				this.gems.setMatrixAt( n ++, _m.compose( _p, _q, _s.set( k, k * 1.4, k ) ) );

			}

		} );
		this.gems.count = n;
		this.gems.instanceMatrix.needsUpdate = true;
		uSunBoost.value = boost * mix;
		return event;

	}

}
