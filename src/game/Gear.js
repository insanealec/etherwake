// Gear data tables. Milestone 5 adds upgrade tiers; for now one starter board.
// Units: metres, seconds, radians.

export const BOARD = {
	gravity: 12, // m/s², pulls the board down in the air and along the swell slopes
	slope: 1.3, // multiplier on the along-slope pull while riding
	thrust: 5, // sail push while holding W, times the point-of-sail efficiency (~1.1 on a beam reach)
	brake: 1.6, // extra linear drag while holding S
	drag: 0.1, // linear drag (1/s)
	dragQuad: 0.012, // quadratic drag (1/m)
	grip: 7, // how fast sideways slip is killed while riding (1/s)
	turnRate: 1.7, // carve rate at speed (rad/s)
	turnMinSpeed: 6, // below this speed the carve rate scales down
	jump: 6.5, // upward kick from Space (m/s), added to the surface's own lift
	pop: 0.8, // extra fraction of the surface's upward speed added when jumping off a rising face
	airTurn: 3.0, // spin rate in the air (rad/s)
	liftOff: 0.15 // gap above the surface (m) before the board counts as airborne
};
