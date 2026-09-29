// Race courses (milestone 5). Gates are given around the harbour as [ angle in degrees (0 = east,
// 90 = south), distance in metres ]; the clock starts at the first gate. Swells run east, so
// westward legs (around 180 degrees) ride into the swell: the big-air stretches.
export const COURSES = [
	{
		id: 'loop', name: 'Harbour Loop',
		gates: [ [ 289, 95 ], [ 330, 175 ], [ 20, 220 ], [ 80, 230 ], [ 140, 220 ], [ 200, 220 ], [ 250, 180 ], [ 289, 110 ] ],
		gold: 68, silver: 85 // seconds (a straight-line autopilot does ~75)
	},
	{
		id: 'crest', name: 'Crest Run',
		gates: [ [ 289, 95 ], [ 250, 250 ], [ 215, 450 ], [ 190, 650 ], [ 165, 820 ], [ 150, 650 ], [ 180, 450 ], [ 230, 250 ], [ 289, 110 ] ],
		gold: 118, silver: 150 // autopilot ~127
	}
];

export const RACE = {
	gateRadius: 6, // ring radius (m); pass within this of the centre
	gateLift: 4, // gate centre height above the swell
	pay: { finish: 20, silver: 40, gold: 90 }, // gold includes silver's rate, not added to it
	bestBonus: 15 // extra for beating your own best time
};
