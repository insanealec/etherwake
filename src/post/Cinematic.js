import { Fn, vec2, vec3, vec4, float, max, dot, mix, length, smoothstep, fract, sin, screenUV, screenSize, Loop } from 'three/tsl';

// The cinematic finish for the post pipeline (milestone 8 polish):
// - godRays(): light shafts streaming from the sun, a radial blur of the bright parts of the scene
//   toward the sun's screen position (fades as the sun leaves the screen);
// - grade(): a little extra saturation, split toning (violet shadows, warm highlights), a vignette and
//   a whisper of film grain.
// Tuning lives in CINEMATIC; it's applied before the pipeline's tone mapping (ACES, set in App).
export const CINEMATIC = {
	rays: { samples: 48, density: 0.85, decay: 0.955, weight: 0.07, threshold: 0.75 },
	saturation: 1.15,
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
			const c = scene.sample( uv ).rgb;
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
		const sat = mix( vec3( luma ), colour, C.saturation );
		const toned = sat.mul( mix( vec3( ...C.shadows ), vec3( ...C.highlights ), smoothstep( 0.02, 0.8, luma ) ) );
		const d = length( screenUV.sub( 0.5 ).mul( vec2( screenSize.x.div( screenSize.y ), 1 ) ) );
		const vig = smoothstep( 1.05, 0.3, d ).mul( C.vignette ).add( 1 - C.vignette );
		const p = screenUV.mul( screenSize ).add( time.mul( 61.7 ) );
		const grain = fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ).mul( 43758.5453 ) ).sub( 0.5 ).mul( C.grain );
		return vec4( toned.mul( vig ).add( grain ), 1 );

	} )();

}
