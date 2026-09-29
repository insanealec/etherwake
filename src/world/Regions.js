import * as THREE from 'three/webgpu';
import { uv, vec3, float, sin, smoothstep, length, positionWorld, cameraPosition, mx_noise_float } from 'three/tsl';
import { REGIONS } from './WorldLayout.js';
import { FLARES } from '../game/Flares.js';
import { setFlareRegion, setFlare } from '../sea/Etherium.js';
import { uSunBoost } from '../sky/Starfield.js';

const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

// Regions (milestone 8). The Flare Reach: its atmosphere blends in as you approach (warmer fog and
// sea), a flickering ember column marks it from afar, and every FLARES.period seconds the star flares:
// the sun pulses (warning), then a flare-front rolls across the Reach away from the sun.
// update() returns 'enter', 'leave', 'warning' or 'launch' on those events (null otherwise).
export class Regions {

	constructor( scene, sea ) {

		this.sea = sea;
		const R = this.flare = REGIONS.flare;
		const l = Math.hypot( ...R.dir );
		this.dir = [ R.dir[ 0 ] / l, R.dir[ 1 ] / l ];
		setFlareRegion( R.x, R.z, this.dir[ 0 ], this.dir[ 1 ], R.radius );
		this.clock = FLARES.period - 30; // the first flare ~30 s after starting
		this.inside = false;
		this.phase = 'calm';

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

	}

	// focus: where the player is (the camera); dt: game time step
	update( dt, focus ) {

		const R = this.flare;
		const d = Math.hypot( focus.x - R.x, focus.z - R.z );
		const mix = smooth( R.radius * 1.35, R.radius * 0.85, d );
		this.sea.regionMix = mix;

		let event = null;
		if ( ! this.inside && d < R.radius ) {

			this.inside = true;
			event = 'enter';

		} else if ( this.inside && d > R.radius * 1.1 ) {

			this.inside = false;
			event = 'leave';

		}

		// the flare cycle: warning, then a front crossing the Reach from its sunward edge
		const F = FLARES;
		const prev = this.clock % F.period;
		this.clock += dt;
		const t = this.clock % F.period;
		const travel = 2 * R.radius / F.speed;
		let boost = 0;
		if ( t < F.warn ) {

			if ( prev >= F.warn ) {

				this.phase = 'warning';
				if ( mix > 0.2 && ! event ) event = 'warning';

			}
			boost = ( 0.6 + 0.6 * Math.sin( this.clock * 7 ) ) * ( t / F.warn );
			setFlare( 0, 0 );

		} else if ( t < F.warn + travel ) {

			if ( prev < F.warn ) {

				this.phase = 'front';
				if ( mix > 0.2 && ! event ) event = 'launch';

			}
			const u = t - F.warn;
			const envelope = smooth( 0, 3, u ) * smooth( travel, travel - 5, u );
			setFlare( - R.radius + u * F.speed, F.height * envelope );
			boost = 2 * Math.max( 0, 1 - u / 4 );

		} else {

			this.phase = 'calm';
			setFlare( 0, 0 );

		}
		uSunBoost.value = boost * mix;
		return event;

	}

	// seconds until the next front launches (for hints)
	get nextFlareIn() {

		const t = this.clock % FLARES.period;
		return t < FLARES.warn ? FLARES.warn - t : FLARES.period - t + FLARES.warn;

	}

}
