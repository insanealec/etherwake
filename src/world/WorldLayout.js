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

// The leviathans' migration loop: an ellipse around the harbour, swum anticlockwise seen from above.
export const MIGRATION = {
	x: 0,
	z: 0,
	radiusX: 560,
	radiusZ: 460,
	speed: 11 // m/s along the loop
};
