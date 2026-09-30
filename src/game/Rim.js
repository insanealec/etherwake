// The Rim (milestone 8): the edge of a black hole's reach. Infalling ring waves instead of the swell, a
// swirling current, low gravity in the air, void pearls hanging high above the sea (reachable with the
// floaty jumps), and Horizon Station with the stargazer's shop.
export const RIM = {
	ringAmp: 5, // m: height of the infalling ring waves
	ringLength: 90, // m: their wavelength
	ringSpeed: 13, // m/s inward
	inner: 280, // ring waves fade out inside this radius (m) and toward the region's edge
	swirl: 3.5, // m/s² tangential push at its strongest (a current carrying you round the centre)
	gravity: 0.65, // air gravity multiplier inside (long, floaty air)
	pearls: 45,
	pearlHeight: [ 7, 13 ], // metres above the swell
	pearl: 15, // credits per void pearl (before the multiplier)
	pearlRespawn: 120,
	multiplier: 2,
	tint: {
		fog: [ 0.05, 0.02, 0.1 ],
		sea: [ 0.65, 0.35, 1.25 ], // violet
		recolor: 0.7
	},
	hole: {
		height: 1100, // above the sea
		ahead: 900, // south of the region centre, so you look up and out at it
		radius: 130, // event horizon
		disk: [ 210, 720 ], // accretion disk inner and outer radius
		tilt: 0.35, // disk tilt (radians)
		lens: 1.3 // lensing strength in the post pass
	}
};
