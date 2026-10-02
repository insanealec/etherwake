// The Ring Reach (milestone 8): where debris from the gas giant's rings has fallen into the etherium.
// Floating ice shards to weave between (close shaves pay), rime crystals to collect, an ice spire as the
// landmark, and Frostwater Station with the ice pilot (shop and the Shard Slalom).
export const RINGS = {
	shards: 220,
	minScale: 3, // shard size range (m)
	maxScale: 11,
	clearOfGates: 25, // shards keep this far from the slalom gates (m)
	closeShave: 4, // credits for passing a shard this close at speed (before the region multiplier)
	shaveMargin: 2.5, // metres past the shard's edge that still counts
	shaveSpeed: 12, // m/s: only at speed
	crystals: 50,
	crystal: 10, // credits per rime crystal
	crystalRespawn: 120, // seconds
	multiplier: 2, // on credits earned inside
	tint: {
		fog: [ 0.03, 0.09, 0.16 ],
		sea: [ 0.45, 0.85, 1.25 ], // frosty blue
		recolor: 0.85, // mostly repaint the sea in the tint (keeping its brightness)
		look: { exposure: 1.05, bloom: 0.4, saturation: 1.0 } // crisp and cool
	}
};
