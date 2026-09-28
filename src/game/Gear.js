// Gear data tables. Milestone 5 adds upgrade tiers; for now one starter board.
// Units: metres, seconds, radians.

export const BOARD = {
	gravity: 12, // m/s², the along-slope pull while riding
	airGravity: 9, // m/s², in the air (a little floaty: it's the etherium)
	slope: 1.3, // multiplier on the slope pull when it speeds you up (running down a face)
	slopeUp: 0.55, // multiplier when it slows you (climbing a face), so momentum carries you up to the lip
	thrust: 6, // sail push while holding W, times the point-of-sail efficiency (see world/Wind.js)
	pump: 1.5, // push while holding W regardless of wind, so you can always crawl upwind
	brake: 1.6, // extra linear drag while holding S
	drag: 0.06, // linear drag (1/s)
	dragQuad: 0.012, // quadratic drag (1/m); with the above: ~20 m/s running, ~23 m/s on a beam reach
	grip: 7, // how fast sideways slip is killed while riding (1/s)
	turnRate: 1.7, // carve rate at speed (rad/s)
	turnMinSpeed: 6, // below this speed the carve rate scales down
	jump: 6.5, // upward kick from Space (m/s), added to the surface's own lift
	pop: 0.6, // extra fraction of the surface's upward speed added when jumping off a rising face
	maxLaunch: 15, // cap on upward speed after a jump (m/s): ~3.3 s of air, ~12 m high
	airTurn: 4.5, // spin rate in the air (rad/s): a 360 takes ~1.4 s
	liftOff: 0.15, // gap above the surface (m) before the board counts as airborne
	cleanAngle: 30, // landing: heading within this many degrees of travel (either stance) is clean
	wipeoutAngle: 65, // beyond this it's a wipeout; in between is sketchy
	sketchyKeep: 0.75, // fraction of speed kept after a sketchy landing
	wipeoutTime: 1.6 // seconds tumbling before you're back on the board
};
