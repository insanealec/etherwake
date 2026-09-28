// The solar wind: one direction for now (later: gusts, regions, flare-fronts).
// angle uses the same convention as the swells in sea/Waves.js (degrees, 0 = blowing toward +x),
// so by default the wind pushes the same way the big swells travel.
export const WIND = {
	angle: 0,
	strength: 1
};

const DEG = Math.PI / 180;
const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

// Sail power for a board heading along yaw (forward = ( sin yaw, 0, cos yaw )).
// theta: angle off dead downwind (0 = running, PI = straight upwind);
// side: +1 / -1 for which side the wind comes over (sets the boom side);
// efficiency: the polar curve, strongest on a beam reach, zero in the no-go zone.
export function sailPower( yaw, out = {} ) {

	const fx = Math.sin( yaw ), fz = Math.cos( yaw );
	const wx = Math.cos( WIND.angle * DEG ), wz = Math.sin( WIND.angle * DEG );
	const theta = Math.acos( Math.max( - 1, Math.min( 1, fx * wx + fz * wz ) ) );
	const deg = theta / DEG;

	out.theta = theta;
	out.side = fx * wz - fz * wx >= 0 ? 1 : - 1;
	out.efficiency = WIND.strength * smooth( 160, 135, deg ) * ( 0.8 + 0.3 * Math.sin( theta ) );
	out.name = deg < 30 ? 'running' : deg < 70 ? 'broad reach' : deg < 110 ? 'beam reach' : deg < 150 ? 'close reach' : 'in irons';
	return out;

}
