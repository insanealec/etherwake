// The trick system (Tony Hawk's Pro Skater on the astral sea). Data tables plus the combo bookkeeping.
//
// In the air: J + a direction pulls an aerial (the whole rig flips; it has to finish before you land or
// you bail), K + a direction holds a grab (points grow while you hold; let go before you land or it's
// sketchy), A/D spin. Everything chains into a combo: score = sum of trick points x number of tricks,
// and a trick repeated in the same combo is worth less each time. After a landing the combo stays live
// for `link` seconds: get airborne again to continue it (riding a bow wave or a flare-front keeps it
// alive, like a manual). A bail loses the lot; otherwise the combo banks when the link runs out.

// aerials, by the direction held when J is pressed. axis: 'roll' (around the board's length) or
// 'pitch' (end over end); turns: full rotations (sign: direction); time: seconds to complete
export const FLIPS = {
	none: { name: 'Barrel Roll', points: 150, axis: 'roll', turns: 1, time: 0.6 },
	W: { name: 'Front Flip', points: 220, axis: 'pitch', turns: 1, time: 0.75 },
	S: { name: 'Backflip', points: 220, axis: 'pitch', turns: - 1, time: 0.75 },
	A: { name: 'Corkscrew', points: 260, axis: 'roll', turns: - 1.5, time: 0.85 },
	D: { name: 'Comet Roll', points: 320, axis: 'roll', turns: 2, time: 1.0 }
};

// grabs, by the direction held when K is first pressed. tilt: how the board is held (radians, nose up /
// rail up) for the pose
export const GRABS = {
	none: { name: 'Melon', points: 60, pitch: 0, roll: 0.35 },
	W: { name: 'Nosegrab', points: 70, pitch: 0.5, roll: 0 },
	S: { name: 'Tailgrab', points: 70, pitch: - 0.5, roll: 0 },
	A: { name: 'Indy', points: 80, pitch: 0, roll: - 0.5 },
	D: { name: 'Method', points: 90, pitch: 0.2, roll: 0.6 }
};

export const TRICK = {
	grabPerSecond: 160, // grab points per second held
	grabMin: 0.25, // seconds a grab must be held to count
	perHalfSpin: 60, // each 180 of spin
	revert: 80,
	hangFrom: 1.5, hangPerSecond: 50, // hangtime past hangFrom seconds
	repeatFactor: 0.5, // each repeat of a trick in one combo is worth this much of the last
	link: 2.2, // seconds after a landing to keep the combo going
	sketchyFactor: 0.6, // a sketchy landing keeps this much of the combo
	creditsPer: 20 // combo points per credit when it banks
};

export class Combo {

	constructor() {

		this.reset();

	}

	reset() {

		this.tricks = []; // { name, points }
		this.base = 0;
		this.counts = {};
		this.linkLeft = 0;
		this.active = false;

	}

	get multiplier() {

		return this.tricks.length;

	}

	get score() {

		return Math.round( this.base * this.multiplier );

	}

	// a trick into the combo (repeats in the same combo are worth less)
	add( name, points ) {

		const n = this.counts[ name ] || 0;
		this.counts[ name ] = n + 1;
		const p = Math.round( points * Math.pow( TRICK.repeatFactor, n ) );
		this.tricks.push( { name, points: p } );
		this.base += p;
		this.active = true;
		this.linkLeft = Infinity; // held open while airborne; land() starts the link timer

	}

	// a landing ends the air: spins, revert and hangtime go in, then the link window opens.
	// r: Surfer's landing result. Returns 'bail' if the combo was lost.
	land( r ) {

		if ( r.kind === 'wipeout' ) {

			const lost = this.active;
			this.reset();
			return lost ? 'bail' : null;

		}
		if ( r.spin >= 180 ) this.add( String( r.spin ), ( r.spin / 180 ) * TRICK.perHalfSpin );
		if ( r.revert && this.active ) this.add( 'Revert', TRICK.revert );
		if ( r.air > TRICK.hangFrom && this.active ) this.add( 'Hangtime', ( r.air - TRICK.hangFrom ) * TRICK.hangPerSecond );
		if ( r.kind === 'sketchy' ) this.base *= TRICK.sketchyFactor;
		if ( this.active ) this.linkLeft = TRICK.link;
		return null;

	}

	// keep the combo alive this frame (riding a bow wave or a flare-front: the astral manual)
	sustain() {

		if ( this.active && this.linkLeft !== Infinity ) this.linkLeft = TRICK.link;

	}

	// per frame while grounded. Returns the banked score when the link runs out, else 0.
	update( dt, grounded ) {

		if ( ! this.active || ! grounded || this.linkLeft === Infinity ) return 0;
		this.linkLeft -= dt;
		if ( this.linkLeft > 0 ) return 0;
		const banked = this.score;
		this.reset();
		return banked;

	}

}
