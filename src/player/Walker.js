import * as THREE from 'three/webgpu';
import { buildFigure, animateFigure } from './Figure.js';
import { DECK_Y } from '../world/Port.js';

const WALK = 4.5; // m/s
const RUN = 8;
const DECK_TOP = DECK_Y + 0.5; // the deck's walking surface

// On-foot mode on the dock: WASD relative to the camera heading, Shift to run, kept on the
// boardwalk and piers by port.walkable() (each axis tried separately, so you slide along edges).
export class Walker {

	constructor( scene, port ) {

		this.port = port;
		this.position = new THREE.Vector3();
		this.yaw = 0; // facing: ( sin yaw, 0, cos yaw )
		this.phase = 0;
		this.moving = 0;
		this.figure = buildFigure( { coat: 0x2c4a6b } );
		this.figure.visible = false;
		scene.add( this.figure );

	}

	place( x, z, yaw ) {

		this.position.set( x, DECK_TOP, z );
		this.yaw = yaw;
		this.sync();

	}

	set visible( v ) {

		this.figure.visible = v;

	}

	// move: { forward: -1..1, right: -1..1, run: bool }; camYaw: the camera's heading
	update( dt, { forward = 0, right = 0, run = false }, camYaw ) {

		const len = Math.hypot( forward, right );
		let target = 0;
		if ( len > 0 ) {

			// camera-relative direction: forward is ( -sin camYaw, -cos camYaw ) for a camera looking down -z
			const fx = - Math.sin( camYaw ), fz = - Math.cos( camYaw );
			const rx = - fz, rz = fx;
			const dx = ( fx * forward + rx * right ) / len, dz = ( fz * forward + rz * right ) / len;
			const step = ( run ? RUN : WALK ) * dt;
			const p = this.position;
			if ( this.port.walkable( p.x + dx * step, p.z ) ) p.x += dx * step;
			if ( this.port.walkable( p.x, p.z + dz * step ) ) p.z += dz * step;

			// turn smoothly toward the walking direction
			const want = Math.atan2( dx, dz );
			const diff = Math.atan2( Math.sin( want - this.yaw ), Math.cos( want - this.yaw ) );
			this.yaw += diff * ( 1 - Math.exp( - 12 * dt ) );
			this.phase += step * 2.2;
			target = run ? 1 : 0.7;

		}
		this.moving += ( target - this.moving ) * ( 1 - Math.exp( - 10 * dt ) );
		this.sync();

	}

	sync() {

		this.figure.position.copy( this.position );
		this.figure.rotation.y = this.yaw;
		animateFigure( this.figure, this.phase, this.moving );

	}

}
