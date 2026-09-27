import { Euler } from 'three/webgpu';

const SPEED = 12;
const FAST = 6;
const LOOK = 0.0022;

// Free-flying debug camera: WASD, Space/C for up/down, Shift for fast, mouse to look.
export class FlyCamera {

	constructor( camera, input ) {

		this.camera = camera;
		this.input = input;
		this.enabled = true;
		this.euler = new Euler( 0, 0, 0, 'YXZ' ).setFromQuaternion( camera.quaternion );

	}

	update( dt ) {

		if ( ! this.enabled ) return;
		const { input, camera, euler } = this;

		const m = input.consumeMouse();
		euler.y -= m.x * LOOK;
		euler.x = Math.max( - 1.55, Math.min( 1.55, euler.x - m.y * LOOK ) );
		camera.quaternion.setFromEuler( euler );

		const speed = SPEED * ( input.down( 'ShiftLeft' ) ? FAST : 1 ) * dt;
		const f = ( input.down( 'KeyW' ) ? 1 : 0 ) - ( input.down( 'KeyS' ) ? 1 : 0 );
		const r = ( input.down( 'KeyD' ) ? 1 : 0 ) - ( input.down( 'KeyA' ) ? 1 : 0 );
		const u = ( input.down( 'Space' ) ? 1 : 0 ) - ( input.down( 'KeyC' ) ? 1 : 0 );
		camera.translateZ( - f * speed );
		camera.translateX( r * speed );
		camera.position.y += u * speed;

	}

}
