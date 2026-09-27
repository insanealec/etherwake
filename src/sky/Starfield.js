import { Fn, vec3, float, floor, fract, sin, dot, length, smoothstep, mix, pow, max, positionWorldDirection, mx_fractal_noise_float } from 'three/tsl';

// cheap float hash of a 3D cell id -> [0,1)
const hash3 = Fn( ( [ p ] ) => fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453 ) ) );

// One layer of stars: the view direction is split into 3D cells, some cells get a star.
const starLayer = Fn( ( [ dir, scale, density ] ) => {

	const p = dir.mul( scale );
	const cell = floor( p );
	const h = hash3( cell );
	const h2 = hash3( cell.add( 17.0 ) );
	const center = cell.add( vec3( hash3( cell.add( 3.0 ) ), h2, hash3( cell.add( 9.0 ) ) ).mul( 0.6 ).add( 0.2 ) );
	const d = length( p.sub( center ) );
	const on = smoothstep( float( 1 ).sub( density ), 1.0, h );
	const core = smoothstep( 0.12, 0.0, d );
	// warm/cool tint per star
	const tint = mix( vec3( 1.0, 0.78, 0.55 ), vec3( 0.7, 0.8, 1.0 ), h2 );
	return tint.mul( core ).mul( on ).mul( h2.mul( 2.0 ).add( 0.5 ) );

} );

// Procedural sky backdrop: three star layers over a faint two-tone nebula haze.
// Placeholder for the full sky (sun, gas giant, rings) in milestone 3.
export class Starfield {

	constructor( scene ) {

		scene.backgroundNode = Fn( () => {

			const dir = positionWorldDirection;

			const stars = starLayer( dir, 90, 0.08 )
				.add( starLayer( dir, 220, 0.12 ).mul( 0.6 ) )
				.add( starLayer( dir, 480, 0.2 ).mul( 0.35 ) );

			const n = mx_fractal_noise_float( dir.mul( 2.2 ), 5, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const n2 = mx_fractal_noise_float( dir.mul( 4.0 ).add( 11.0 ), 4, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const haze = mix( vec3( 0.10, 0.03, 0.16 ), vec3( 0.02, 0.07, 0.14 ), n2 ).mul( pow( max( n, 0.0 ), 2.5 ).mul( 1.6 ) );

			const base = vec3( 0.006, 0.004, 0.014 );
			return base.add( haze ).add( stars );

		} )();

	}

}
