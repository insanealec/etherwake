import { Vector3 } from 'three/webgpu';

// defaults for the board; the galleon passes bigger numbers
const DEFAULTS = {
	distance: 9, // behind the target (m)
	height: 3.2, // above the target (m)
	lookAhead: 7, // look this far past the target along its heading
	lookUp: 1.2, // aim this far above the target
	follow: 4.5, // position spring rate (1/s)
	aim: 9, // look-target spring rate (1/s)
	clearance: 1.5 // keep this far above the sea
};

// motion feel: camera shake from landings (trauma, decays) and a faint rumble at speed; the wider
// field of view and speed lines that also come with speed are applied in App (see MOTION.speed)
export const MOTION = {
	shake: { perImpact: 0.07, max: 1, decay: 1.1, roll: 0.05, pitch: 0.04 }, // trauma per unit impact, cap, decay /s; max angles (rad)
	rumble: 0.18, // shake level at full speed
	speed: { from: 12, to: 34, fov: 9, lines: 1 } // m/s range mapped to 0..1; extra fov (deg); line strength
};

const _target = new Vector3();
const _fwd = new Vector3();

// Spring-damped chase camera behind the surfer; dips and shakes on hard landings, rumbles at speed.
export class ChaseCamera {

	// target: anything with position, velocity, speed and forward() (the surfer, the galleon)
	constructor( camera, sea, options = {} ) {

		this.o = { ...DEFAULTS, ...options };
		this.camera = camera;
		this.sea = sea;
		this.look = new Vector3();
		this.heading = new Vector3( 0, 0, 1 );
		this.dip = 0;
		this.trauma = 0; // 0..1, from landings
		this.rumble = 0; // 0..1, set from the speed each frame
		this.t = 0;

	}

	// jump straight to the resting pose (no spring), e.g. when switching back from the fly camera
	snap( surfer ) {

		surfer.forward( this.heading );
		this.place( surfer, 1, 1 );

	}

	land( impact ) {

		this.dip = Math.min( 1.5, this.dip + impact * 0.12 );
		this.trauma = Math.min( MOTION.shake.max, this.trauma + impact * MOTION.shake.perImpact );

	}

	update( dt, surfer ) {

		// follow the travel direction when moving, else the board heading
		const s = surfer.speed;
		if ( s > 2 ) _fwd.set( surfer.velocity.x / s, 0, surfer.velocity.z / s );
		else surfer.forward( _fwd );
		this.heading.lerp( _fwd, 1 - Math.exp( - 3 * dt ) ).normalize();

		this.dip *= Math.exp( - 4 * dt );
		this.trauma = Math.max( 0, this.trauma - MOTION.shake.decay * dt );
		this.t += dt;
		this.place( surfer, 1 - Math.exp( - this.o.follow * dt ), 1 - Math.exp( - this.o.aim * dt ) );

	}

	place( surfer, kPos, kLook ) {

		const { camera, heading } = this;
		const p = surfer.position;

		_target.copy( p ).addScaledVector( heading, - this.o.distance );
		_target.y += this.o.height - this.dip;
		camera.position.lerp( _target, kPos );
		const floor = this.sea.heightAt( camera.position.x, camera.position.z ) + this.o.clearance;
		if ( camera.position.y < floor ) camera.position.y = floor;

		_target.copy( p ).addScaledVector( heading, this.o.lookAhead );
		_target.y += this.o.lookUp;
		this.look.lerp( _target, kLook );
		camera.lookAt( this.look );

		// shake: trauma squared (small knocks stay subtle), smooth pseudo-noise from summed sines
		const k = this.trauma * this.trauma + this.rumble * MOTION.rumble * 0.25, t = this.t, S = MOTION.shake;
		if ( k > 0.0005 ) {

			const n = ( a, b, c ) => Math.sin( t * a + c ) * 0.6 + Math.sin( t * b + c * 2.1 ) * 0.4;
			camera.rotateZ( n( 23, 37, 1 ) * S.roll * k );
			camera.rotateX( n( 29, 41, 4 ) * S.pitch * k );

		}

	}

}
