// Race courses (milestone 5). Gates are given around the harbour (or `center`: a region) as [ angle in degrees (0 = east,
// 90 = south), distance in metres ]; the clock starts at the first gate. Swells run east, so
// westward legs (around 180 degrees) ride into the swell. Every gate boosts you if you cross its centre.
export const COURSES = [
	{
		id: 'loop', name: 'Harbour Loop',
		gates: [ [ 289, 95 ], [ 330, 175 ], [ 20, 220 ], [ 80, 230 ], [ 140, 220 ], [ 200, 220 ], [ 250, 180 ], [ 289, 110 ] ],
		gold: 60, silver: 72 // seconds; a straight-line autopilot hitting every centre does ~65
	},
	{
		id: 'crest', name: 'Crest Run',
		gates: [ [ 289, 95 ], [ 250, 250 ], [ 215, 450 ], [ 190, 650 ], [ 165, 820 ], [ 150, 650 ], [ 180, 450 ], [ 230, 250 ], [ 289, 110 ] ],
		gold: 108, silver: 130 // autopilot ~117
	},
	{
		// run by the ice pilot at Frostwater Station; gates weave around the spire, centred on the Ring Reach
		id: 'slalom', name: 'Shard Slalom', center: 'rings',
		gates: [ [ 0, 190 ], [ 36, 320 ], [ 72, 200 ], [ 108, 330 ], [ 144, 190 ], [ 180, 320 ], [ 216, 200 ], [ 252, 330 ], [ 288, 190 ], [ 324, 320 ], [ 350, 200 ] ],
		gold: 108, silver: 130 // a straight-line autopilot hitting every centre does ~117
	}
];

export const RACE = {
	gateRadius: 6, // ring radius (m)
	lift: 1.2, // gate centre height above the swell: the rider's height, so the sweet spot is on the surface
	boostRadius: 2.5, // cross within this of the centre for the boost
	boostSpeed: 9, // m/s added along the heading
	pay: { finish: 20, silver: 40, gold: 90 }, // gold includes silver's rate, not added to it
	bestBonus: 15 // extra for beating your own best time
};
