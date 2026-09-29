// Port characters: who stands where and what they say. Names are placeholders (see docs/concept.md).
// shack: index into the port's shacks (0 is just north of the east pier, 7 just south of it).

// at the Ember Outpost, in the Flare Reach
export const TRADER = {
	id: 'trader', name: 'Outpost trader',
	greeting: 'Made it out to the Reach, did you? Everything the shipwright sells, I sell, and closer to the flares. What\'ll it be?'
};

// at Frostwater Station, in the Ring Reach
export const PILOT = {
	id: 'pilot', name: 'Ice pilot',
	greeting: 'Cold enough for you? The shards are mean but they pay: brush past them fast and you\'ll feel it. I stock the shipwright\'s gear, and I run the Shard Slalom round the spire.'
};

// aboard the solar galleon
export const QUARTERMASTER = {
	name: 'Quartermaster',
	lines: [
		'Ahoy, and mind the wet planks. Welcome aboard the old courier galleon.',
		'The captain\'s ashore and the helm stays lashed till the shipwright signs her over.',
		'Till then, the deck\'s yours to wander. Drop in off either rail when you\'ve had your fill.'
	],
	// once you own her
	ownedLines: [
		'Captain! She\'s yours now, papers and all.',
		'The helm\'s just forward of the stern castle. W lets out more sail, S takes it in, and give her room to turn.'
	]
};

export const CHARACTERS = [
	{
		id: 'dockmaster', name: 'Dockmaster', shack: 0, coat: 0x3b2a55, hat: 0x1c1420,
		lines: [
			'Welcome to Brasslight Harbor, surfer. Tie up anywhere that isn\'t on fire.',
			'The job board\'s still drying. Courier runs and races soon: the flare season\'s nearly on us.',
			'Want real air? Ride against the swell, not with it. Every rookie learns that the hard way.'
		]
	},
	{
		id: 'shipwright', name: 'Shipwright', shack: 7, coat: 0x6b4a2a, hat: null,
		lines: [
			'Mind the rail. You\'ll scuff the brass.',
			'That board of yours pulls a hair to the left. Bring me coin and I\'ll true it: faster, grippier, whatever you can afford.',
			'Shop\'s not open yet. Still sorting my spanners. Come back soon.'
		]
	},
	{
		id: 'marshal', name: 'Race marshal', shack: 6, coat: 0x7a1f2b, hat: 0xd9c9a3,
		lines: [
			'Fancy yourself quick? Gates are set, clock\'s wound. Pick a course.'
		]
	},
	{
		id: 'tea', name: 'Tea-seller', shack: 1, coat: 0x2f5a52, hat: 0x7a2a35,
		lines: [
			'Nebula tea? Steeped in etherium. Tastes like a sunrise, mostly.',
			'Those motes out there? Old starlight, settling. My gran used to say you could read your luck in them.'
		]
	}
];
