import * as THREE from 'three/webgpu';
import { BOARD } from '../game/Gear.js';
import { WIND, sailPower } from '../world/Wind.js';

const STEP = 1 / 120; // physics substep (s)
const WORLD_UP = new THREE.Vector3( 0, 1, 0 );
const MAX_LIFT = 20; // m/s cap on the surface's vertical speed (guards against sea edits / time jumps)

// vertical speed of a board glued to the surface
const liftSpeed = ( surface, yPrev, h ) => Math.max( - MAX_LIFT, Math.min( MAX_LIFT, ( surface - yPrev ) / h ) );

const _n = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

// The solar surfer: board physics against the etherium's heightAt / normalAt.
// Horizontal velocity is integrated freely; while riding, the height follows the
// surface and the vertical speed is whatever the surface does under the board, so
// cresting a swell fast enough throws the board into the air on its own.
export class Surfer {

	constructor( scene, sea ) {

		this.sea = sea;
		this.position = new THREE.Vector3();
		this.velocity = new THREE.Vector3();
		this.yaw = 0; // heading: forward = ( sin yaw, 0, cos yaw )
		this.grounded = true;
		this.steer = 0; // smoothed -1..1, for lean
		this.crouch = 0;
		this.up = new THREE.Vector3( 0, 1, 0 ); // smoothed board up
		this.onLand = null; // callback( impactSpeed )
		this.sailState = {}; // sailPower() result for the current heading
		this.boomSide = 1;

		this.object = this.buildModel();
		scene.add( this.object );
		this.reset( 0, 0, Math.PI / 2 );

	}

	reset( x, z, yaw = this.yaw ) {

		this.position.set( x, this.sea.heightAt( x, z ), z );
		this.velocity.set( Math.sin( yaw ) * 8, 0, Math.cos( yaw ) * 8 );
		this.yaw = yaw;
		this.grounded = true;

	}

	get speed() {

		return Math.hypot( this.velocity.x, this.velocity.z );

	}

	forward( target = new THREE.Vector3() ) {

		return target.set( Math.sin( this.yaw ), 0, Math.cos( this.yaw ) );

	}

	// controls: { steer: -1..1 (right positive), throttle: -1..1, jump: bool }
	update( dt, controls ) {

		if ( ! ( dt > 0 ) ) return;
		const n = Math.max( 1, Math.ceil( dt / STEP - 1e-6 ) );
		const h = dt / n;
		const t0 = this.sea.time - dt;
		for ( let i = 0; i < n; i ++ ) {

			this.step( h, t0 + ( i + 1 ) * h, controls );
			controls = { ...controls, jump: false };

		}
		this.updateModel( dt, controls );

	}

	step( h, t, { steer = 0, throttle = 0, jump = false } ) {

		const { position: p, velocity: v, sea } = this;
		const B = BOARD;

		if ( this.grounded ) {

			sea.normalAt( p.x, p.z, t, _n );
			const speed = this.speed;

			// carve: turn rate scales down when slow
			this.yaw -= steer * B.turnRate * Math.min( 1, 0.3 + speed / B.turnMinSpeed ) * h;
			const fx = Math.sin( this.yaw ), fz = Math.cos( this.yaw );

			// slope pull (the normal's horizontal part points downhill) and sail thrust,
			// scaled by the point of sail (fastest on a beam reach, nothing head to wind)
			const push = B.thrust * sailPower( this.yaw, this.sailState ).efficiency * Math.max( 0, throttle );
			v.x += ( B.gravity * B.slope * _n.x + fx * push ) * h;
			v.z += ( B.gravity * B.slope * _n.z + fz * push ) * h;

			// grip: bleed the sideways part of the velocity
			const fwd = v.x * fx + v.z * fz;
			let latX = v.x - fx * fwd, latZ = v.z - fz * fwd;
			const keep = Math.exp( - B.grip * h );
			latX *= keep; latZ *= keep;

			// drag (plus brake)
			const lin = B.drag + ( throttle < 0 ? B.brake * - throttle : 0 );
			const fwd2 = fwd * Math.max( 0, 1 - ( lin + B.dragQuad * Math.abs( fwd ) ) * h );
			v.x = fx * fwd2 + latX;
			v.z = fz * fwd2 + latZ;

			if ( jump ) {

				// crest pop: jumping off a rising face adds part of the surface's lift
				v.y += B.jump + B.pop * Math.max( 0, v.y );
				this.grounded = false;

			}

		} else {

			this.yaw -= steer * B.airTurn * h;

		}

		// vertical: ballistic, then resolve against the surface
		const yPrev = p.y;
		v.y -= B.gravity * h;
		p.x += v.x * h;
		p.y += v.y * h;
		p.z += v.z * h;

		const surface = sea.heightAt( p.x, p.z, t );
		if ( p.y <= surface ) {

			if ( ! this.grounded ) {

				const impact = Math.max( 0, - v.y );
				this.grounded = true;
				if ( this.onLand ) this.onLand( impact );

			}
			p.y = surface;
			v.y = liftSpeed( surface, yPrev, h );

		} else if ( this.grounded && p.y - surface < B.liftOff && ! jump ) {

			// small gaps: stay glued to the surface
			p.y = surface;
			v.y = liftSpeed( surface, yPrev, h );

		} else {

			this.grounded = false;

		}

	}

	buildModel() {

		const group = new THREE.Group();
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		const wood = new THREE.MeshStandardNodeMaterial( { color: 0x6b3f22, roughness: 0.6 } );
		const canvas = new THREE.MeshStandardNodeMaterial( { color: 0xeadcb8, roughness: 0.9, side: THREE.DoubleSide } );
		const cloth = new THREE.MeshStandardNodeMaterial( { color: 0x2c4a6b, roughness: 0.8 } );
		const skin = new THREE.MeshStandardNodeMaterial( { color: 0xc98f6a, roughness: 0.7 } );

		// board: a flattened capsule with a brass rim, long axis +z
		const board = new THREE.Mesh( new THREE.CapsuleGeometry( 0.32, 1.7, 4, 12 ), wood );
		board.rotation.x = Math.PI / 2;
		board.scale.set( 1, 1, 0.22 );
		board.position.y = 0.08;
		group.add( board );
		const rim = new THREE.Mesh( new THREE.TorusGeometry( 0.3, 0.03, 6, 24 ), brass );
		rim.rotation.x = Math.PI / 2;
		rim.scale.set( 1, 3.4, 1 );
		rim.position.y = 0.08;
		group.add( rim );

		// mast and a triangular sail trailing back from it, rider beside the sail
		const mast = new THREE.Mesh( new THREE.CylinderGeometry( 0.03, 0.04, 2.6, 8 ), brass );
		mast.position.set( 0, 1.4, 0.35 );
		group.add( mast );
		const sailShape = new THREE.Shape();
		sailShape.moveTo( 0, 0 );
		sailShape.lineTo( 0, 2.2 );
		sailShape.lineTo( 1.1, 0.15 );
		sailShape.lineTo( 0, 0 );
		const sail = new THREE.Mesh( new THREE.ShapeGeometry( sailShape ), canvas );
		sail.rotation.y = Math.PI / 2;
		sail.position.set( 0, 0.35, 0.35 );
		group.add( sail );
		this.sail = sail;

		// rider: body, head and legs, in a pivot so it can lean and crouch
		const rider = new THREE.Group();
		const body = new THREE.Mesh( new THREE.CapsuleGeometry( 0.2, 0.55, 4, 10 ), cloth );
		body.position.y = 1.2;
		rider.add( body );
		const head = new THREE.Mesh( new THREE.SphereGeometry( 0.15, 14, 10 ), skin );
		head.position.y = 1.72;
		rider.add( head );
		const legGeo = new THREE.CapsuleGeometry( 0.08, 0.6, 3, 8 );
		for ( const z of [ - 0.2, 0.2 ] ) {

			const leg = new THREE.Mesh( legGeo, cloth );
			leg.position.set( 0, 0.55, z );
			rider.add( leg );

		}
		rider.position.set( 0.28, 0, - 0.45 );
		group.add( rider );
		this.rider = rider;

		return group;

	}

	updateModel( dt, controls ) {

		const k = 1 - Math.exp( - 10 * dt );
		this.steer += ( ( controls.steer || 0 ) - this.steer ) * k;
		this.crouch += ( ( controls.throttle > 0 || ! this.grounded ? 1 : 0 ) - this.crouch ) * k;

		// board up follows the surface normal while riding, drifts upright in the air
		const target = this.grounded ? this.sea.normalAt( this.position.x, this.position.z, this.sea.time, _n ) : WORLD_UP;
		this.up.lerp( target, this.grounded ? k : 1 - Math.exp( - 2 * dt ) ).normalize();

		this.forward( _f );
		_f.addScaledVector( this.up, - _f.dot( this.up ) ).normalize();
		_r.crossVectors( this.up, _f );
		_m.makeBasis( _r, this.up, _f );
		this.object.quaternion.setFromRotationMatrix( _m );
		// lean into the carve
		const lean = this.steer * Math.min( 1, this.speed / 12 ) * 0.45;
		this.object.quaternion.multiply( _q.setFromAxisAngle( _f.set( 0, 0, 1 ), lean ) );
		this.object.position.copy( this.position );

		this.rider.scale.y = 1 - this.crouch * 0.2;

		// boom swings out to the downwind side: square when running, close in when reaching upwind
		const st = sailPower( this.yaw, this.sailState );
		const across = Math.cos( WIND.angle * Math.PI / 180 ) * Math.cos( this.yaw ) - Math.sin( WIND.angle * Math.PI / 180 ) * Math.sin( this.yaw );
		if ( Math.abs( across ) > 0.15 ) this.boomSide = Math.sign( across );
		const boom = - this.boomSide * Math.max( 0.25, ( Math.PI - st.theta ) / 2 );
		this.sail.rotation.y += ( Math.PI / 2 + boom - this.sail.rotation.y ) * k;
		this.rider.rotation.z = lean * 0.3;

	}

}
