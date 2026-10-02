import * as THREE from 'three/webgpu';
import { buildFigure, animateFigure } from './Figure.js';

const WALK = 4.5; // m/s
const RUN = 8;
const _dir = new THREE.Vector3();

// On-foot mode: WASD relative to the camera heading, Shift to run. The walker stands on a *platform*
// (the port's boardwalk, the galleon's deck): { walkable( lx, lz ), deckY, yaw, toWorld( local, out ),
// launchEdge( lx, lz ) }. Position is kept in the platform's own coordinates, so a moving deck carries
// you; `position` is the world position, refreshed each frame. Each axis is tried separately, so you
// slide along rails and walls.
export class Walker {

	constructor( scene ) {

		this.platform = null;
		this.local = new THREE.Vector3();
		this.position = new THREE.Vector3(); // world
		this.yaw = 0; // facing on the platform: ( sin yaw, 0, cos yaw ) in platform coordinates
		this.phase = 0;
		this.moving = 0;
		this.figure = buildFigure( { coat: 0x2c4a6b, goggles: true } ); // the player: same look as the rider
		this.figure.visible = false;
		scene.add( this.figure );

	}

	// stand on `platform` at local ( lx, lz ), facing local yaw
	place( platform, lx, lz, yaw ) {

		this.platform = platform;
		this.local.set( lx, platform.deckY, lz );
		this.yaw = yaw;
		this.sync();

	}

	set visible( v ) {

		this.figure.visible = v;

	}

	// move: { forward: -1..1, right: -1..1, run: bool }; camYaw: the camera's heading (world)
	update( dt, { forward = 0, right = 0, run = false }, camYaw ) {

		const len = Math.hypot( forward, right );
		let target = 0;
		if ( len > 0 ) {

			// camera-relative direction in the world (camera looks down its -z), then into platform coordinates
			const fx = - Math.sin( camYaw ), fz = - Math.cos( camYaw );
			const wx = ( fx * forward - fz * right ) / len, wz = ( fz * forward + fx * right ) / len;
			const py = this.platform.yaw, c = Math.cos( py ), s = Math.sin( py );
			const dx = wx * c - wz * s, dz = wx * s + wz * c;
			const step = ( run ? RUN : WALK ) * dt;
			const p = this.local;
			if ( this.platform.walkable( p.x + dx * step, p.z ) ) p.x += dx * step;
			if ( this.platform.walkable( p.x, p.z + dz * step ) ) p.z += dz * step;

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

	// refresh the world position (call every frame: the platform may be moving)
	sync() {

		if ( ! this.platform ) return;
		this.platform.toWorld( _dir.copy( this.local ), this.position );
		this.figure.position.copy( this.position );
		this.figure.rotation.y = this.platform.yaw + this.yaw;
		animateFigure( this.figure, this.phase, this.moving );

	}

}
