import { Vector3 } from 'three/webgpu';

const DISTANCE = 9; // behind the board (m)
const HEIGHT = 3.2; // above the board (m)
const LOOK_AHEAD = 7; // look this far past the board along its heading
const FOLLOW = 4.5; // position spring rate (1/s)
const AIM = 9; // look-target spring rate (1/s)
const CLEARANCE = 1.5; // keep this far above the sea

const _target = new Vector3();
const _fwd = new Vector3();

// Spring-damped chase camera behind the surfer; dips on hard landings.
export class ChaseCamera {

	constructor( camera, sea ) {

		this.camera = camera;
		this.sea = sea;
		this.look = new Vector3();
		this.heading = new Vector3( 0, 0, 1 );
		this.dip = 0;

	}

	// jump straight to the resting pose (no spring), e.g. when switching back from the fly camera
	snap( surfer ) {

		surfer.forward( this.heading );
		this.place( surfer, 1, 1 );

	}

	land( impact ) {

		this.dip = Math.min( 1.5, this.dip + impact * 0.12 );

	}

	update( dt, surfer ) {

		// follow the travel direction when moving, else the board heading
		const s = surfer.speed;
		if ( s > 2 ) _fwd.set( surfer.velocity.x / s, 0, surfer.velocity.z / s );
		else surfer.forward( _fwd );
		this.heading.lerp( _fwd, 1 - Math.exp( - 3 * dt ) ).normalize();

		this.dip *= Math.exp( - 4 * dt );
		this.place( surfer, 1 - Math.exp( - FOLLOW * dt ), 1 - Math.exp( - AIM * dt ) );

	}

	place( surfer, kPos, kLook ) {

		const { camera, heading } = this;
		const p = surfer.position;

		_target.copy( p ).addScaledVector( heading, - DISTANCE );
		_target.y += HEIGHT - this.dip;
		camera.position.lerp( _target, kPos );
		const floor = this.sea.heightAt( camera.position.x, camera.position.z ) + CLEARANCE;
		if ( camera.position.y < floor ) camera.position.y = floor;

		_target.copy( p ).addScaledVector( heading, LOOK_AHEAD );
		_target.y += 1.2;
		this.look.lerp( _target, kLook );
		camera.lookAt( this.look );

	}

}
