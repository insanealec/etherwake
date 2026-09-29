// Gear data tables: the starter board (BOARD) and the shipwright's upgrades (UPGRADES), which
// modify BOARD's numbers.
// Units: metres, seconds, radians.

export const BOARD = {
	gravity: 12, // m/s², the along-slope pull while riding
	airGravity: 9, // m/s², in the air (a little floaty: it's the etherium)
	slope: 1.3, // multiplier on the slope pull when it speeds you up (running down a face)
	slopeUp: 0.55, // multiplier when it slows you (climbing a face), so momentum carries you up to the lip
	thrust: 6, // sail push while holding W, times the point-of-sail efficiency (see world/Wind.js)
	pump: 1.5, // push while holding W regardless of wind, so you can always crawl upwind
	brake: 1.6, // extra linear drag while holding S
	drag: 0.06, // linear drag (1/s)
	dragQuad: 0.012, // quadratic drag (1/m); with the above: ~20 m/s running, ~23 m/s on a beam reach
	grip: 7, // how fast sideways slip is killed while riding (1/s)
	turnRate: 1.7, // carve rate at speed (rad/s)
	turnMinSpeed: 6, // below this speed the carve rate scales down
	jump: 6.5, // upward kick from Space (m/s), added to the surface's own lift
	pop: 0.6, // extra fraction of the surface's upward speed added when jumping off a rising face
	maxLaunch: 15, // cap on upward speed after a jump (m/s): ~3.3 s of air, ~12 m high
	airTurn: 4.5, // spin rate in the air (rad/s): a 360 takes ~1.4 s
	liftOff: 0.15, // gap above the surface (m) before the board counts as airborne
	cleanAngle: 30, // landing: heading within this many degrees of travel (either stance) is clean
	wipeoutAngle: 65, // beyond this it's a wipeout; in between is sketchy
	sketchyKeep: 0.75, // fraction of speed kept after a sketchy landing
	wipeoutTime: 1.6 // seconds tumbling before you're back on the board
};

// The starter board's numbers, kept so upgrades can be re-applied from scratch.
export const BASE_BOARD = { ...BOARD };

// The shipwright's upgrades: each line has tiers; buying tier n sets the listed BOARD numbers.
export const UPGRADES = [
	{
		id: 'sail', name: 'Sail canvas', blurb: 'more push from the solar wind',
		tiers: [
			{ cost: 80, set: { thrust: 7.2 } },
			{ cost: 200, set: { thrust: 8.6 } },
			{ cost: 450, set: { thrust: 10 } }
		]
	},
	{
		id: 'hull', name: 'Hull polish', blurb: 'less drag, higher top speed',
		tiers: [
			{ cost: 100, set: { dragQuad: 0.0105 } },
			{ cost: 250, set: { dragQuad: 0.009 } },
			{ cost: 500, set: { dragQuad: 0.0078 } }
		]
	},
	{
		id: 'rails', name: 'Grip rails', blurb: 'carve harder, slip less',
		tiers: [
			{ cost: 60, set: { grip: 8.5, turnRate: 1.9 } },
			{ cost: 150, set: { grip: 10, turnRate: 2.1 } },
			{ cost: 350, set: { grip: 12, turnRate: 2.3 } }
		]
	},
	{
		id: 'springs', name: 'Pop springs', blurb: 'bigger jumps',
		tiers: [
			{ cost: 90, set: { jump: 7.5, maxLaunch: 16.5 } },
			{ cost: 220, set: { jump: 8.5, maxLaunch: 18 } },
			{ cost: 480, set: { jump: 9.5, maxLaunch: 20 } }
		]
	}
];

const ROMAN = [ '', 'I', 'II', 'III' ];
export const tierName = ( up, level ) => `${ up.name } ${ ROMAN[ level ] }`;

// Reset BOARD to the starter numbers, then apply each owned upgrade tier. levels: { sail: 2, ... }
export function applyUpgrades( levels ) {

	Object.assign( BOARD, BASE_BOARD );
	for ( const up of UPGRADES ) {

		const level = levels[ up.id ] || 0;
		if ( level > 0 ) Object.assign( BOARD, up.tiers[ level - 1 ].set );

	}

}
