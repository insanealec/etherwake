// World positions (metres). Systems read placements from here, not from their own constants.

// The port (Brasslight Harbor, working name): a moonlet ringed by a boardwalk and piers.
// Swells calm down inside the harbour: full height beyond `fadeRadius`, `calm` fraction within `calmRadius`.
export const HARBOR = {
	x: 0,
	z: 0,
	calmRadius: 140,
	fadeRadius: 320,
	calm: 0.1
};

// Where the surfer starts: just off the east pier's end, heading out to sea.
export const SPAWN = { x: 118, z: 6, yaw: Math.PI / 2 };
