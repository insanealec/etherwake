// Etherium swell parameters. One table drives both the JS wave function (physics)
// and the TSL vertex displacement (rendering), see sea/Etherium.js.
//
// Units are metres and seconds. Gerstner waves: amplitude = steepness / k, so
// the sum of steepness should stay below 1 or crests loop over themselves.

export const SEA = {
	gravity: 5.0, // dispersion "gravity": lower = slower, dreamier swells
	steepness: 1.0, // global multiplier on every wave's steepness (horizontal pinch)
	height: 1.0, // global multiplier on vertical displacement only
	fadeStart: 10, // small waves fade out between fadeStart and fadeEnd wavelengths from the camera
	fadeEnd: 28
};

export const WAVES = [
	// wavelength (m), steepness (0..1), angle (degrees, 0 = +x), speed multiplier
	{ wavelength: 160, steepness: 0.22, angle: 0, speed: 1.0 },
	{ wavelength: 97, steepness: 0.17, angle: 28, speed: 1.0 },
	{ wavelength: 61, steepness: 0.13, angle: - 35, speed: 1.0 },
	{ wavelength: 33, steepness: 0.10, angle: 70, speed: 1.0 },
	{ wavelength: 19, steepness: 0.08, angle: - 80, speed: 1.0 },
	{ wavelength: 9.5, steepness: 0.06, angle: 132, speed: 1.0 }
];
