// Flare-front tuning (the Flare Reach, milestone 8). Every `period` seconds the star flares: a warning
// (the sun pulses) for `warn` seconds, then a single solitary wave-front launches from the Reach's
// sunward edge and rolls across it away from the sun.
export const FLARES = {
	period: 95, // seconds between flares
	warn: 8, // seconds of warning before the front launches
	speed: 22, // m/s: about the board's speed running with it at full sail, so you can hold its face
	height: 12, // m, crest above the ordinary swell
	width: 35 // m: the front's thickness scale (sech² profile)
};

// Region atmosphere inside the Reach (linear colours)
export const FLARE_TINT = {
	fog: [ 0.2, 0.05, 0.015 ],
	sea: [ 1.35, 0.7, 0.4 ], // multiplies the sea's colour
	glow: [ 1.0, 0.45, 0.1 ] // added along the front's face, scaled by its height
};
