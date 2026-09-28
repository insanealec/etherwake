import { Vector2, Vector3 } from 'three/webgpu';
import { Fn, uniform, vec2, vec3, float, length, smoothstep, screenUV, screenSize } from 'three/tsl';

// Subtle sun flare for the post pipeline: soft tinted ghost discs along the line from the sun's
// screen position through the centre. update() projects the sun each frame; the flare fades as
// the sun nears the screen edge or goes behind the camera.
const GHOSTS = [
	// position along the sun -> centre line (1 = sun, 0 = centre, negative = beyond), radius (fraction of height), colour
	[ 0.55, 0.05, [ 0.10, 0.05, 0.02 ] ],
	[ - 0.25, 0.09, [ 0.05, 0.03, 0.06 ] ],
	[ - 0.6, 0.035, [ 0.03, 0.07, 0.06 ] ],
	[ - 1.1, 0.14, [ 0.04, 0.02, 0.05 ] ]
];

const _v = new Vector3();

export class SunFlare {

	constructor( sunDir ) {

		this.sunDir = sunDir;
		this.uSun = uniform( new Vector2( 0.5, 0.5 ) );
		this.uVis = uniform( 0 );

		this.node = Fn( () => {

			const aspect = screenSize.x.div( screenSize.y );
			const toSun = this.uSun.sub( 0.5 );
			const sum = vec3( 0 ).toVar();
			for ( const [ f, r, c ] of GHOSTS ) {

				const d = screenUV.sub( 0.5 ).sub( toSun.mul( f ) ).mul( vec2( aspect, 1 ) );
				sum.addAssign( vec3( ...c ).mul( smoothstep( float( r ), float( r * 0.55 ), length( d ) ) ) );

			}
			return sum.mul( this.uVis );

		} )();

	}

	update( camera ) {

		_v.copy( camera.position ).addScaledVector( this.sunDir.value, 1000 ).project( camera );
		const edge = Math.max( Math.abs( _v.x ), Math.abs( _v.y ) );
		this.uVis.value = _v.z < 1 ? Math.max( 0, Math.min( 1, ( 1.3 - edge ) / 0.5 ) ) : 0;
		this.uSun.value.set( _v.x * 0.5 + 0.5, 0.5 - _v.y * 0.5 );

	}

}
