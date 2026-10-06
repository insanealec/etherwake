import { Fn, uniform, vec2, vec3, vec4, float, max, dot, mix, length, smoothstep, fract, sin, floor, abs, atan, screenUV, screenSize, Loop } from 'three/tsl';

// The cinematic finish for the post pipeline (milestone 8 polish):
// - godRays(): light shafts streaming from the sun, a radial blur of the bright parts of the scene
//   toward the sun's screen position (fades as the sun leaves the screen);
// - grade(): a little extra saturation, split toning (violet shadows, warm highlights), a vignette and
//   a whisper of film grain.
// Tuning lives in CINEMATIC; it's applied before the pipeline's tone mapping (ACES, set in App).
// The open sea's look; each region can override it (`tint.look` in game/Flares.js, Rings.js, Rim.js),
// blended in as you enter (world/Regions.js) and applied in App: tone-mapping exposure, bloom strength
// and the grade's saturation.
export const LOOK = { exposure: 1.0, bloom: 0.55, saturation: 1.15 };
export const uSaturation = uniform( LOOK.saturation );

export const CINEMATIC = {
	rays: { samples: 48, density: 0.85, decay: 0.955, weight: 0.07, threshold: 0.75 },
	shadows: [ 0.9, 0.88, 1.15 ], // multiplies the darks: lifted toward violet
	highlights: [ 1.07, 1.0, 0.9 ], // multiplies the brights: warm
	vignette: 0.32, // how much the corners darken
	grain: 0.012
};

// scene: a texture node (sampled along the rays); sunUV: vec2 uniform (screen UV, y down); visible: 0..1
export function godRays( scene, sunUV, visible ) {

	const R = CINEMATIC.rays;
	return Fn( () => {

		const uv = screenUV.toVar();
		const step = uv.sub( sunUV ).mul( R.density / R.samples );
		const light = float( 1 ).toVar();
		const sum = vec3( 0 ).toVar();
		Loop( R.samples, () => {

			uv.subAssign( step );
			const c = scene.sample( uv ).rgb.max( 0 ).min( 60000 ); // a NaN pixel would streak across the screen
			sum.addAssign( max( c.sub( R.threshold ), 0 ).mul( light ).mul( R.weight ) );
			light.mulAssign( R.decay );

		} );
		return sum.mul( visible );

	} )();

}

// colour: the linear HDR colour (vec3 node); time: a float node (for the grain)
export function grade( colour, time ) {

	const C = CINEMATIC;
	return Fn( () => {

		const luma = dot( colour, vec3( 0.2126, 0.7152, 0.0722 ) );
		const sat = mix( vec3( luma ), colour, uSaturation );
		const toned = sat.mul( mix( vec3( ...C.shadows ), vec3( ...C.highlights ), smoothstep( 0.02, 0.8, luma ) ) );
		const d = length( screenUV.sub( 0.5 ).mul( vec2( screenSize.x.div( screenSize.y ), 1 ) ) );
		const vig = smoothstep( 1.05, 0.3, d ).mul( C.vignette ).add( 1 - C.vignette );
		const p = screenUV.mul( screenSize ).add( time.mul( 61.7 ) );
		const grain = fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ).mul( 43758.5453 ) ).sub( 0.5 ).mul( C.grain );
		return vec4( toned.mul( vig ).add( grain ), 1 );

	} )();

}

// Speed lines: thin dashes streaming outward from the middle of the screen, only near the edges.
// amount: 0..1 float node (from the speed); time: float node
export const SPEED_LINES = { count: 110, density: 0.35, colour: [ 1.0, 0.86, 0.72 ], strength: 0.22 };
export function speedLines( amount, time ) {

	const L = SPEED_LINES;
	return Fn( () => {

		const d = screenUV.sub( 0.5 ).mul( vec2( screenSize.x.div( screenSize.y ), 1 ) );
		const r = length( d );
		const a = atan( d.y, d.x ).div( Math.PI * 2 ).add( 0.5 ).mul( L.count );
		const id = floor( a );
		const h = fract( sin( id.mul( 12.9898 ) ).mul( 43758.5453 ) );
		const on = smoothstep( 1 - L.density, 1 - L.density + 0.02, h );
		const thin = smoothstep( 0.18, 0.0, abs( fract( a ).sub( 0.5 ) ) );
		const s = fract( r.mul( 1.6 ).sub( time.mul( h.mul( 1.5 ).add( 1.8 ) ) ).add( h.mul( 7.0 ) ) );
		const dash = smoothstep( 0.0, 0.08, s ).mul( smoothstep( 0.55, 0.15, s ) );
		const edge = smoothstep( 0.28, 0.62, r );
		return vec3( ...L.colour ).mul( on.mul( thin ).mul( dash ).mul( edge ).mul( amount ).mul( L.strength ) );

	} )();

}
