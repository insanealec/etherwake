// World positions (metres). Systems read placements from here, not from their own constants.

// The port (Brasslight Harbor, working name): a moonlet ringed by a boardwalk.
// Swells calm down inside the harbour: full height beyond `fadeRadius`, `calm` fraction within `calmRadius`.
export const HARBOR = {
	x: 0,
	z: 0,
	calmRadius: 140,
	fadeRadius: 320,
	calm: 0.1
};

// Where the surfer starts: just off the boardwalk's east side, heading out to sea.
export const SPAWN = { x: 70, z: 6, yaw: Math.PI / 2 };

// The solar galleon (milestone 7): anchored north of the harbour, beyond the whales and the stardust,
// so it's a lantern-lit silhouette on the horizon. North makes the trip a beam reach both ways.
// yaw: the way the bow points (0 = +z); it lies across the swell so it rolls.
export const GALLEON = { x: - 120, z: - 1150, yaw: 0.3 };

// Regions (milestone 8): distant stretches of sea with their own weather.
// The Flare Reach lies toward the sun (the sun's horizontal direction from the harbour, ~4 km out);
// flare-fronts roll across it away from the sun along `dir`.
export const REGIONS = {
	// swell: the Reach's swell height multiplier (blends in toward the edge)
	flare: { name: 'the Flare Reach', x: - 2480, z: - 3120, radius: 1400, dir: [ 0.62, 0.78 ], swell: 1.8 },
	// toward the gas giant (its horizontal direction from the harbour, ~4.2 km out)
	rings: { name: 'the Ring Reach', x: 3385, z: - 2482, radius: 1300 },
	// south of the harbour, under the black hole (a beam reach both ways)
	rim: { name: 'the Rim', x: 400, z: 4600, radius: 1400 }
};

// The Ember Outpost: a floating trading raft at the heart of the Flare Reach
export const OUTPOST = { x: - 2480, z: - 3120 };

// Frostwater Station: beside the ice spire at the heart of the Ring Reach
export const FROSTWATER = { x: 3385 + 110, z: - 2482 + 20 };

// Horizon Station: at the Rim's calm-ish centre, where the ring waves fade
export const HORIZON = { x: 400 + 60, z: 4600 - 40 };

// The leviathans' migration loop: an ellipse around the harbour, swum anticlockwise seen from above.
export const MIGRATION = {
	x: 0,
	z: 0,
	radiusX: 560,
	radiusZ: 460,
	speed: 11 // m/s along the loop
};
