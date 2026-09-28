import { Vector3, Raycaster } from 'three/webgpu';

const DISTANCE = 6;
const LOOK = 0.0025; // mouse sensitivity
const KEY_TURN = 1.8; // rad/s with the arrow keys
const _target = new Vector3();
const _dir = new Vector3();
const _ray = new Raycaster();

// Third-person orbit camera for walking: the mouse (pointer lock) or the arrow keys orbit it around
// the walker; it looks at the walker's shoulders. If `obstacles` (meshes) block the view, the camera
// pulls in in front of them.
export class WalkCamera {

	constructor( camera, input, obstacles = [] ) {

		this.camera = camera;
		this.obstacles = obstacles;
		this.input = input;
		this.yaw = 0; // camera heading: it looks along ( -sin yaw, 0, -cos yaw )
		this.pitch = - 0.25;

	}

	// face the same way as the walker, from behind
	snap( walker ) {

		this.yaw = walker.yaw + Math.PI;
		this.update( 0, walker );

	}

	update( dt, walker ) {

		const { input } = this;
		const m = input.consumeMouse();
		this.yaw -= m.x * LOOK;
		this.pitch = Math.max( - 1.2, Math.min( 0.4, this.pitch - m.y * LOOK ) );
		this.yaw += ( ( input.down( 'ArrowLeft' ) ? 1 : 0 ) - ( input.down( 'ArrowRight' ) ? 1 : 0 ) ) * KEY_TURN * dt;

		const cp = Math.cos( this.pitch );
		_target.copy( walker.position );
		_target.y += 1.5;
		_dir.set( Math.sin( this.yaw ) * cp, - Math.sin( this.pitch ), Math.cos( this.yaw ) * cp );
		let dist = DISTANCE;
		if ( this.obstacles.length ) {

			_ray.set( _target, _dir );
			_ray.far = DISTANCE;
			const hit = _ray.intersectObjects( this.obstacles, true )[ 0 ];
			if ( hit ) dist = Math.max( 0.6, hit.distance - 0.3 );

		}
		this.camera.position.copy( _target ).addScaledVector( _dir, dist );
		this.camera.lookAt( _target );

	}

}
