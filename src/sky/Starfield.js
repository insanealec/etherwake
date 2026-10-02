import { Fn, uniform, vec3, float, floor, fract, sin, dot, length, smoothstep, mix, pow, max, exp, select, positionWorldDirection, normalize, mx_fractal_noise_float, mx_noise_vec3 } from 'three/tsl';

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

// Nebula cliffs: banks of glowing gas rising from the horizon all around (after the JWST "Cosmic Cliffs"):
// rust and amber bodies, edges lit from the sun's side, blue gas glowing just above their tops, and the
// low parts fading into the horizon haze (aerial perspective). Fake volume: the lighting compares the
// density here with the density a step toward the sun.
export const NEBULA = {
	height: 0.3, // how high the tallest banks reach (sin of elevation)
	scale: 2.8, // size of the billows (higher: smaller)
	warp: 0.35, // how much the billows swirl
	light: 0.05, // how far toward the sun the lighting looks
	opacity: 0.9,
	shade: [ 0.035, 0.012, 0.03 ], // in the shadowed folds
	body: [ 0.30, 0.09, 0.04 ], // rust
	lit: [ 1.1, 0.48, 0.14 ], // sun-lit amber edges
	blue: [ 0.03, 0.12, 0.38 ] // the glowing gas above the banks
};

// TSL: the cliffs' density in direction dir (0..1), and the billow noise there
const nebulaDensity = ( dir ) => {

	const N = NEBULA;
	const q = dir.add( mx_noise_vec3( dir.mul( 1.6 ) ).mul( N.warp ) );
	const billows = mx_fractal_noise_float( q.mul( N.scale ), 5, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
	const top = mx_fractal_noise_float( vec3( dir.x, 0, dir.z ).mul( 1.4 ).add( 5.0 ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 ).mul( N.height );
	const dens = smoothstep( 0.0, 0.1, top.add( billows.sub( 0.5 ).mul( 0.22 ) ).sub( dir.y ) ).mul( billows.add( 0.4 ) ).clamp();
	return { dens, billows, top };

};

function nebulaCliffs( dir, sun, horizon ) {

	const N = NEBULA;
	const here = nebulaDensity( dir );
	const toward = nebulaDensity( normalize( dir.add( sun.mul( N.light ) ) ) ).dens;
	const lit = here.dens.sub( toward ).mul( 3.0 ).add( 0.35 ).clamp(); // edges facing the sun catch the light
	const col = mix( vec3( ...N.shade ), vec3( ...N.body ), here.billows ).add( vec3( ...N.lit ).mul( lit.mul( lit ) ).mul( here.billows ) ).toVar();
	col.assign( mix( col, horizon.mul( 1.6 ), exp( max( dir.y, 0 ).mul( - 9.0 ) ).mul( 0.55 ) ) ); // aerial perspective
	const glow = smoothstep( here.top.add( 0.22 ), here.top, dir.y ).mul( here.billows ); // blue gas over the tops
	return { col, alpha: here.dens.mul( N.opacity ), glow: vec3( ...N.blue ).mul( glow ) };

}

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
			const neb = nebulaCliffs( dir, sun || vec3( 0, 1, 0 ), horizon );
			sky.addAssign( neb.glow );
			sky.assign( mix( sky, neb.col, neb.alpha ) );
			if ( sun ) {

				const d = max( dot( dir, sun ), 0.0 );
				const disc = smoothstep( 0.99955, 0.9997, d ).mul( 30.0 ); // ~1.5 degrees across
				const corona = pow( d, 900.0 ).mul( 2.5 );
				const glow = pow( d, 18.0 ).mul( 0.18 ).add( pow( d, 4.0 ).mul( 0.025 ) );
				sky.addAssign( vec3( 1.0, 0.72, 0.42 ).mul( disc.add( corona ) ).add( vec3( 1.0, 0.35, 0.15 ).mul( glow ) ).mul( uSunBoost.add( 1 ) ).mul( neb.alpha.mul( 0.6 ).oneMinus() ) );

			}
			// below the horizon we're looking at the (fogged) sea beyond the grid edge
			const below = mix( horizon, horizon.mul( 0.3 ), smoothstep( 0.0, - 0.35, dir.y ) );
			return mix( select( dir.y.lessThan( 0.0 ), below, sky ), horizon, underwater );

		} )();

	}

}
