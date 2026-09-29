import { Fn, uniform, vec3, float, floor, fract, sin, dot, length, smoothstep, mix, pow, max, exp, select, positionWorldDirection, mx_fractal_noise_float } from 'three/tsl';

// cheap float hash of a 3D cell id -> [0,1)
const hash3 = Fn( ( [ p ] ) => fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453 ) ) );

// One layer of stars: the view direction is split into 3D cells, some cells get a star.
// the sun's extra brightness: flares pulse it (world/Regions.js)
export const uSunBoost = uniform( 0 );

export const starLayer = Fn( ( [ dir, scale, density ] ) => {

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

// the galaxy band's plane (its normal); the band arcs up from the horizon across the sky
const GALAXY_NORMAL = vec3( 0.35, 0.55, 0.76 ).normalize();

// Procedural sky backdrop: three star layers over a faint two-tone nebula haze, a galaxy band, the horizon band,
// and the sun (a hot disc for bloom to catch, a tight corona and a wide warm glow).
// The gas giant is a separate mesh (sky/GasGiant.js).
export class Starfield {

	// horizon: optional vec3 node (the sea's fog colour) for the horizon band and below-horizon fill
	// underwater: optional 0/1 node; when 1 the whole backdrop becomes the (underwater) fog colour
	// sun: optional normalized vec3 node, the direction toward the sun
	constructor( scene, { horizon = vec3( 0.10, 0.02, 0.09 ), underwater = float( 0 ), sun = null } = {} ) {

		scene.backgroundNode = Fn( () => {

			const dir = positionWorldDirection;

			// galaxy band: a great circle across the sky, clumpy glow cut by dark dust lanes, with extra stars
			const across = dot( dir, GALAXY_NORMAL );
			const along = mx_fractal_noise_float( dir.mul( 6.0 ), 4, 2.0, 0.55 ).mul( 0.5 ).add( 0.5 );
			const band = exp( across.mul( across ).mul( - 60.0 ) ).mul( along.mul( 0.8 ).add( 0.4 ) );
			const lanes = smoothstep( 0.55, 0.75, mx_fractal_noise_float( dir.mul( 11.0 ).add( 3.0 ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 ) );
			const galaxy = band.mul( lanes.mul( 0.75 ).oneMinus() );

			const stars = starLayer( dir, 90, 0.08 )
				.add( starLayer( dir, 220, galaxy.mul( 0.25 ).add( 0.12 ) ).mul( 0.6 ) )
				.add( starLayer( dir, 480, galaxy.mul( 0.5 ).add( 0.2 ) ).mul( 0.35 ) );

			const n = mx_fractal_noise_float( dir.mul( 2.2 ), 5, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const n2 = mx_fractal_noise_float( dir.mul( 4.0 ).add( 11.0 ), 4, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const haze = mix( vec3( 0.10, 0.03, 0.16 ), vec3( 0.02, 0.07, 0.14 ), n2 ).mul( pow( max( n, 0.0 ), 2.5 ).mul( 1.6 ) );

			const base = vec3( 0.006, 0.004, 0.014 );
			const glow = mix( vec3( 0.16, 0.09, 0.14 ), vec3( 0.09, 0.08, 0.16 ), along ).mul( galaxy ).mul( 0.55 );
			const sky = base.add( haze ).add( glow ).add( stars ).add( horizon.mul( exp( dir.y.mul( - 14.0 ) ) ).mul( 0.8 ) ).toVar();
			if ( sun ) {

				const d = max( dot( dir, sun ), 0.0 );
				const disc = smoothstep( 0.99955, 0.9997, d ).mul( 30.0 ); // ~1.5 degrees across
				const corona = pow( d, 900.0 ).mul( 2.5 );
				const glow = pow( d, 18.0 ).mul( 0.18 ).add( pow( d, 4.0 ).mul( 0.025 ) );
				sky.addAssign( vec3( 1.0, 0.72, 0.42 ).mul( disc.add( corona ) ).add( vec3( 1.0, 0.35, 0.15 ).mul( glow ) ).mul( uSunBoost.add( 1 ) ) );

			}
			// below the horizon we're looking at the (fogged) sea beyond the grid edge
			const below = mix( horizon, horizon.mul( 0.3 ), smoothstep( 0.0, - 0.35, dir.y ) );
			return mix( select( dir.y.lessThan( 0.0 ), below, sky ), horizon, underwater );

		} )();

	}

}
