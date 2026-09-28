// What things pay, in credits. Tuning lives here.

export const REWARDS = {
	stardust: 1, // each mote of stardust
	trailBonus: 5, // collecting a whole trail
	perHalfSpin: 12, // each 180 of spin on a landed trick
	revert: 5,
	airPerSecond: 4, // air time past `airFrom` seconds
	airFrom: 1.5,
	sketchyFactor: 0.5 // sketchy landings pay this fraction
};

// Stardust trails scattered over the open sea (not in the harbour).
export const STARDUST = {
	trails: 48,
	perTrail: 10,
	spacing: 5, // metres between motes along a trail
	minRadius: 220, // from the harbour
	maxRadius: 1100,
	arcChance: 0.35, // share of trails that arc high over a crest (need a jump)
	arcHeight: 7,
	respawn: 90, // seconds before a collected trail reappears
	pickupRadius: 2.4
};

// Credits for a landing result from Surfer.land(); 0 for a wipeout.
export function trickPayout( r ) {

	if ( r.kind === 'wipeout' ) return 0;
	let pay = ( r.spin / 180 ) * REWARDS.perHalfSpin;
	if ( r.revert ) pay += REWARDS.revert;
	if ( r.air > REWARDS.airFrom ) pay += ( r.air - REWARDS.airFrom ) * REWARDS.airPerSecond;
	if ( r.kind === 'sketchy' ) pay *= REWARDS.sketchyFactor;
	return Math.round( pay );

}
