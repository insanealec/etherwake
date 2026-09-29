// Race courses (milestone 5). Gates are given around the harbour as [ angle in degrees (0 = east,
// 90 = south), distance in metres, type ]; the clock starts at the first gate. Swells run east, so
// westward legs (around 180 degrees) ride into the swell: the big-air stretches.
// Gate types: 'gate' (plain), 'boost' (pass through the glowing centre for a burst of speed),
// 'air' (set a little higher: any ordinary jump clears it, no big wave needed).
export const COURSES = [
	{
		id: 'loop', name: 'Harbour Loop',
		gates: [ [ 289, 95 ], [ 330, 175, 'boost' ], [ 20, 220 ], [ 80, 230, 'boost' ], [ 140, 220, 'air' ], [ 200, 220, 'boost' ], [ 250, 180 ], [ 289, 110 ] ],
		gold: 62, silver: 76 // seconds; a straight-line autopilot hitting every boost does ~68
	},
	{
		id: 'crest', name: 'Crest Run',
		gates: [ [ 289, 95 ], [ 250, 250, 'boost' ], [ 215, 450, 'air' ], [ 190, 650, 'air' ], [ 165, 820 ], [ 150, 650, 'boost' ], [ 180, 450, 'air' ], [ 230, 250, 'boost' ], [ 289, 110 ] ],
		gold: 115, silver: 140 // autopilot ~125
	}
];

export const RACE = {
	gateRadius: 6, // ring radius (m)
	// gate centre height above the swell, per type: plain gates are tall arches; boost gates are centred
	// at the rider's height so the sweet spot is on the surface; air gates' rings clear the swell by 1.5 m
	lift: { gate: 4, boost: 1.2, air: 7.5 },
	boostRadius: 2.5, // pass within this of a boost gate's centre for the boost
	boostSpeed: 9, // m/s added along the heading
	pay: { finish: 20, silver: 40, gold: 90 }, // gold includes silver's rate, not added to it
	bestBonus: 15 // extra for beating your own best time
};
