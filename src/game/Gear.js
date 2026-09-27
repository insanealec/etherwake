// Gear data tables. Milestone 5 adds upgrade tiers; for now one starter board.
// Units: metres, seconds, radians.

export const BOARD = {
	gravity: 12, // m/s², pulls the board down in the air and along the swell slopes
	slope: 1.0, // multiplier on the along-slope pull while riding
	thrust: 5, // forward push while holding W (the sail, until wind lands); ~16 m/s cruise
	brake: 1.6, // extra linear drag while holding S
	drag: 0.1, // linear drag (1/s)
	dragQuad: 0.012, // quadratic drag (1/m)
	grip: 7, // how fast sideways slip is killed while riding (1/s)
	turnRate: 1.7, // carve rate at speed (rad/s)
	turnMinSpeed: 6, // below this speed the carve rate scales down
	jump: 6.5, // upward kick from Space (m/s), added to the surface's own lift
	airTurn: 3.0, // spin rate in the air (rad/s)
	liftOff: 0.15 // gap above the surface (m) before the board counts as airborne
};
