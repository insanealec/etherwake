import * as THREE from 'three/webgpu';
import { Fn, vec3, sin, uv, time, positionLocal, smoothstep, fract, mix, color } from 'three/tsl';

// The solar surfer's hero model, built from shaped primitives (no assets):
// - the board: a shaped hull (pointed nose, squared tail, bevelled rails, nose and tail rocker), a brass
//   rail trim (its material is the landing cue, see Surfer), a gold inlay and twin tail thrusters that
//   glow with the throttle;
// - a cambered solar sail on a brass mast, with glowing gold battens, a fluttering leech and a wishbone
//   boom;
// - the rider: jointed legs and arms solved each frame (two-bone IK), sideways surf stance with real knee
//   bend when crouching, hands on the boom, swapping stance when the sail crosses sides; flight goggles
//   and a scarf streaming behind.
// Board frame: long axis +z (nose), up +y, deck at y = DECK.
export const DECK = 0.11;
const SAIL_AT = new THREE.Vector3( 0, 0.35, 0.35 ); // the sail's foot at the mast
const BOOM_Y = 0.75; // the wishbone's height on the sail

const UP = new THREE.Vector3( 0, 1, 0 );
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

// lay a segment mesh (built by limb(), along +y) from a to b, stretched to fit exactly,
// so the joints never show gaps
function place( mesh, a, b ) {

	mesh.position.copy( a );
	_d.subVectors( b, a );
	const len = _d.length();
	mesh.quaternion.setFromUnitVectors( UP, _d.divideScalar( len || 1 ) );
	mesh.scale.y = len / mesh.geometry.userData.len;

}

// two-bone IK: the middle joint for a chain root -> target with bone lengths l1, l2, bending toward pole
function solveJoint( root, target, l1, l2, pole, out ) {

	_d.subVectors( target, root );
	const d = Math.min( _d.length(), ( l1 + l2 ) * 0.999 );
	_d.normalize();
	const a = ( l1 * l1 - l2 * l2 + d * d ) / ( 2 * d ); // along the chain to the joint's foot
	const h = Math.sqrt( Math.max( 0, l1 * l1 - a * a ) );
	_p.copy( pole ).addScaledVector( _d, - pole.dot( _d ) ).normalize(); // pole, perpendicular to the chain
	return out.copy( root ).addScaledVector( _d, a ).addScaledVector( _p, h );

}

// a segment geometry from y = 0 to y = len (tapering r0 -> r1)
const limb = ( r0, r1, len ) => {

	const g = new THREE.CylinderGeometry( r1, r0, len, 10 ).translate( 0, len / 2, 0 );
	g.userData.len = len;
	return g;

};

function boardShape() {

	const s = new THREE.Shape(); // x: across, y: along (+y is the nose)
	s.moveTo( - 0.19, - 1.1 );
	s.lineTo( 0.19, - 1.1 );
	s.bezierCurveTo( 0.29, - 0.95, 0.33, - 0.3, 0.3, 0.3 );
	s.quadraticCurveTo( 0.24, 1.0, 0, 1.28 );
	s.quadraticCurveTo( - 0.24, 1.0, - 0.3, 0.3 );
	s.bezierCurveTo( - 0.33, - 0.3, - 0.29, - 0.95, - 0.19, - 1.1 );
	return s;

}

// nose and tail kick (m) at board position z
const rocker = ( z ) => Math.max( 0, z - 0.35 ) ** 2 * 0.22 + Math.max( 0, - z - 0.75 ) ** 2 * 0.3;

export function buildSurferModel() {

	const group = new THREE.Group();
	const brass = new THREE.MeshStandardNodeMaterial( { color: 0xc8963f, metalness: 0.9, roughness: 0.3 } );

	// --- board ---
	const shape = boardShape();
	const T = 0.05, BEV = 0.03;
	const geo = new THREE.ExtrudeGeometry( shape, { depth: T, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3, curveSegments: 28 } );
	geo.rotateX( Math.PI / 2 ); // shape y -> +z, extrusion -> -y
	geo.translate( 0, T + BEV, 0 ); // deck on top at y = DECK
	const pos = geo.attributes.position;
	for ( let i = 0; i < pos.count; i ++ ) pos.setY( i, pos.getY( i ) + rocker( pos.getZ( i ) ) );
	geo.computeVertexNormals();
	// lacquered wood deck on top, dark hull underneath
	const boardMat = new THREE.MeshStandardNodeMaterial( { roughness: 0.4, metalness: 0.05 } );
	boardMat.colorNode = Fn( () => {

		const top = smoothstep( 0.04, 0.09, positionLocal.y );
		// wood grain along the board
		const grain = sin( positionLocal.x.mul( 90 ).add( sin( positionLocal.z.mul( 6 ) ).mul( 2 ) ) ).mul( 0.5 ).add( 0.5 );
		const wood = mix( color( 0x3a1f0e ), color( 0x5c3418 ), grain );
		return mix( color( 0x1d1a2e ), wood, top );

	} )();
	const board = new THREE.Mesh( geo, boardMat );
	group.add( board );

	// brass rail trim (its own material: it glows as the landing cue)
	const rimMat = new THREE.MeshStandardNodeMaterial( { color: 0xc8963f, metalness: 0.85, roughness: 0.3 } );
	const rail = shape.getSpacedPoints( 120 ).map( ( p ) => new THREE.Vector3( p.x * 1.1, BEV + T * 0.6 + rocker( p.y ), p.y * 1.02 ) );
	rail.pop();
	const rim = new THREE.Mesh( new THREE.TubeGeometry( new THREE.CatmullRomCurve3( rail, true ), 200, 0.018, 6, true ), rimMat );
	group.add( rim );

	// gold inlay down the deck
	const inlayMat = new THREE.MeshStandardNodeMaterial( { color: 0xd9a54a, metalness: 0.8, roughness: 0.3, emissive: 0x3a2008 } );
	const inlay = new THREE.Mesh( new THREE.PlaneGeometry( 0.035, 1.25 ).rotateX( - Math.PI / 2 ), inlayMat );
	inlay.position.set( 0, DECK + 0.002, - 0.2 );
	group.add( inlay );

	// twin tail thrusters with glowing nozzles
	const engineMat = new THREE.MeshBasicNodeMaterial( { color: 0xff8030 } );
	for ( const x of [ - 0.14, 0.14 ] ) {

		const pod = new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.07, 0.34, 14 ).rotateX( Math.PI / 2 ), brass );
		pod.position.set( x, DECK + 0.06 + rocker( - 1.0 ), - 0.98 );
		const nozzle = new THREE.Mesh( new THREE.CircleGeometry( 0.05, 14 ).rotateY( Math.PI ), engineMat );
		nozzle.position.set( x, pod.position.y, - 1.155 );
		const ring = new THREE.Mesh( new THREE.TorusGeometry( 0.062, 0.012, 6, 16 ), brass );
		ring.position.copy( nozzle.position );
		group.add( pod, nozzle, ring );

	}

	// --- mast, sail, boom ---
	const mast = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.04, 2.6, 10 ), brass );
	mast.position.set( 0, 1.4, 0.35 );
	const foot = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.1, 0.06, 14 ), brass );
	foot.position.set( 0, DECK + 0.03, 0.35 );
	const cap = new THREE.Mesh( new THREE.SphereGeometry( 0.05, 10, 8 ), brass );
	cap.position.set( 0, 2.7, 0.35 );
	group.add( mast, foot, cap );

	const sail = new THREE.Mesh( sailGeometry(), sailMaterial() );
	sail.position.copy( SAIL_AT );
	group.add( sail );
	// wishbone boom: an ellipse around the sail at chest height (a child, so it swings with the sail)
	const boom = new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.018, 6, 40 ).rotateX( Math.PI / 2 ), brass );
	boom.scale.set( 1, 1, 0.28 );
	boom.position.set( 0.5, BOOM_Y, 0 );
	sail.add( boom );

	// --- rider ---
	const rider = buildRider();
	group.add( rider );

	// scarf: streams behind the rider (in the board frame, so it trails toward the tail)
	const scarf = new THREE.Mesh( new THREE.PlaneGeometry( 0.1, 0.9, 1, 16 ).translate( 0, 0.45, 0 ).rotateX( - Math.PI / 2 + 0.15 ), scarfMaterial() );
	group.add( scarf );

	const state = { side: 1, turn: 0 };
	const grip = [ new THREE.Vector3(), new THREE.Vector3() ];
	const knee = new THREE.Vector3(), elbow = new THREE.Vector3(), hip = new THREE.Vector3(), foot3 = new THREE.Vector3();
	const neck = new THREE.Vector3();
	const KNEE_POLE = new THREE.Vector3( 1, 0, 0 ), ELBOW_POLE = new THREE.Vector3( - 0.6, - 1, 0 );

	// pose each frame. crouch, throttle: 0..1; side: which side the sail is on (+1 / -1)
	function update( dt, { crouch = 0, throttle = 0, side = 1 } ) {

		const k = 1 - Math.exp( - 6 * dt );
		// stance: stand on the windward side facing the sail; swap feet (turn round) when it crosses over
		state.side = side;
		state.turn += ( ( side > 0 ? 0 : Math.PI ) - state.turn ) * k;
		rider.position.set( - Math.cos( state.turn ) * 0.22, 0, - 0.32 );
		rider.rotation.y = state.turn;

		// hips drop and sit back as you crouch; the torso leans out against the sail's pull
		hip.set( - 0.06 - crouch * 0.06, 0.9 - crouch * 0.13, 0 );
		const R = rider.parts;
		R.pelvis.position.copy( hip );
		for ( const leg of R.legs ) {

			_a.set( hip.x, hip.y - 0.04, leg.z * 0.09 ); // hip socket, under the pelvis
			foot3.set( 0.02, DECK + 0.02, leg.z * 0.32 );
			solveJoint( _a, foot3, 0.45, 0.45, KNEE_POLE, knee );
			place( leg.thigh, _a, knee );
			place( leg.shin, knee, foot3 );
			leg.boot.position.copy( foot3 );

		}
		_b.set( - 0.22 + crouch * 0.3, 1, 0 ).normalize(); // torso direction
		R.torso.position.copy( hip );
		R.torso.quaternion.setFromUnitVectors( UP, _b );
		neck.copy( hip ).addScaledVector( _b, 0.56 );
		R.head.position.copy( neck ).addScaledVector( _b, 0.17 );
		R.head.quaternion.copy( R.torso.quaternion );

		// hands on the boom: two grips on the near side of the wishbone, in the rider's frame
		group.updateMatrixWorld();
		for ( let i = 0; i < 2; i ++ ) {

			grip[ i ].set( 0.1 + i * 0.28, BOOM_Y, - 0.12 * side );
			sail.localToWorld( grip[ i ] );
			rider.worldToLocal( grip[ i ] );

		}
		for ( const arm of R.arms ) {

			_a.copy( neck ).addScaledVector( _b, - 0.06 );
			_a.z += arm.z * 0.2;
			const g = grip[ arm.z * ( state.turn < Math.PI / 2 ? 1 : - 1 ) > 0 ? 0 : 1 ];
			solveJoint( _a, g, 0.34, 0.34, ELBOW_POLE, elbow );
			place( arm.upper, _a, elbow );
			place( arm.fore, elbow, g );
			arm.hand.position.copy( g );

		}

		// scarf: knot at the neck, in the board frame
		rider.localToWorld( _p.copy( neck ) );
		group.worldToLocal( _p );
		scarf.position.copy( _p );

		// thrusters glow with the throttle
		const glow = 0.6 + throttle * 3.5;
		engineMat.color.setRGB( glow, glow * 0.42, glow * 0.12 );

	}

	return { group, rimMat, sail, rider, scarf, update };

}

// a cambered triangular sail with a convex leech: luff up the mast (x = 0), foot along +x
function sailGeometry() {

	const ROWS = 14, COLS = 8, H = 2.2, FOOT = 1.15;
	const pos = [], uvs = [], idx = [];
	for ( let i = 0; i <= ROWS; i ++ ) {

		const h = i / ROWS;
		const w = FOOT * Math.pow( 1 - h, 0.85 ) + 0.16 * Math.sin( Math.PI * h ) * ( 1 - h ); // roach
		for ( let j = 0; j <= COLS; j ++ ) {

			const u = j / COLS;
			pos.push( w * u, H * h, Math.sin( Math.PI * u ) * w * 0.13 ); // camber
			uvs.push( u, h );

		}

	}
	for ( let i = 0; i < ROWS; i ++ ) for ( let j = 0; j < COLS; j ++ ) {

		const a = i * ( COLS + 1 ) + j, b = a + COLS + 1;
		idx.push( a, a + 1, b, a + 1, b + 1, b );

	}
	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	return g;

}

function sailMaterial() {

	const mat = new THREE.MeshStandardNodeMaterial( { side: THREE.DoubleSide, roughness: 0.75 } );
	const u = uv().x, v = uv().y;
	// the trailing edge flutters; the luff on the mast stays put
	mat.positionNode = positionLocal.add( vec3( 0, 0, sin( time.mul( 11 ).add( v.mul( 7 ) ).sub( u.mul( 4 ) ) ).mul( 0.022 ).mul( u.mul( u ) ) ) );
	// canvas with darker panel seams; the battens are solar strips that glow gold
	const seam = smoothstep( 0.04, 0.0, fract( u.mul( 4 ) ).sub( 0.5 ).abs().sub( 0.46 ).abs() );
	mat.colorNode = mix( color( 0xeadcb8 ), color( 0xb89d70 ), seam.mul( 0.6 ) );
	const batten = smoothstep( 0.035, 0.0, fract( v.mul( 6 ) ).sub( 0.5 ).abs().sub( 0.47 ).abs() ).mul( smoothstep( 0.02, 0.1, u ) );
	// a little light through the canvas (it reads when backlit), plus the battens
	mat.emissiveNode = color( 0x5a3a28 ).add( color( 0xffa040 ).mul( batten.mul( sin( time.mul( 2 ).sub( u.mul( 6 ) ) ).mul( 0.3 ).add( 0.9 ) ) ).mul( 1.6 ) );
	return mat;

}

function scarfMaterial() {

	const mat = new THREE.MeshStandardNodeMaterial( { color: 0xc23048, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x2a0810 } );
	const v = uv().y; // 0 at the knot, 1 at the tail
	mat.positionNode = positionLocal.add( vec3(
		sin( time.mul( 9 ).sub( v.mul( 9 ) ) ).mul( 0.09 ).mul( v ),
		sin( time.mul( 6 ).sub( v.mul( 6 ) ) ).mul( 0.05 ).mul( v ),
		0
	) );
	return mat;

}

function buildRider() {

	const coat = new THREE.MeshStandardNodeMaterial( { color: 0x2c4a6b, roughness: 0.75 } );
	const trousers = new THREE.MeshStandardNodeMaterial( { color: 0x3a2e28, roughness: 0.85 } );
	const leather = new THREE.MeshStandardNodeMaterial( { color: 0x2a1a10, roughness: 0.6 } );
	const skin = new THREE.MeshStandardNodeMaterial( { color: 0xc98f6a, roughness: 0.7 } );
	const hairMat = new THREE.MeshStandardNodeMaterial( { color: 0x3a2214, roughness: 0.9 } );
	const brass = new THREE.MeshStandardNodeMaterial( { color: 0xc8963f, metalness: 0.9, roughness: 0.3 } );
	const lens = new THREE.MeshStandardNodeMaterial( { color: 0x40200a, emissive: 0xff8a30, emissiveIntensity: 0.6, roughness: 0.2 } );

	const rider = new THREE.Group();
	const parts = { legs: [], arms: [] };

	parts.pelvis = new THREE.Mesh( new THREE.SphereGeometry( 0.15, 12, 8 ).scale( 0.8, 0.7, 1 ), trousers );
	// torso: a tapered coat from the hips to the shoulders (chest depth along x, facing +x), with a belt
	const torsoGeo = new THREE.CylinderGeometry( 0.2, 0.15, 0.56, 12 ).translate( 0, 0.28, 0 ).scale( 0.72, 1, 1 );
	parts.torso = new THREE.Mesh( torsoGeo, coat );
	const belt = new THREE.Mesh( new THREE.TorusGeometry( 0.15, 0.022, 6, 16 ).rotateX( Math.PI / 2 ).scale( 0.75, 1, 1 ), leather );
	belt.position.y = 0.07;
	const buckle = new THREE.Mesh( new THREE.BoxGeometry( 0.02, 0.05, 0.06 ), brass );
	buckle.position.set( 0.115, 0.07, 0 );
	const collar = new THREE.Mesh( new THREE.TorusGeometry( 0.1, 0.035, 6, 14 ).rotateX( Math.PI / 2 ), coat );
	collar.position.y = 0.55;
	parts.torso.add( belt, buckle, collar );

	// head with swept hair and flight goggles pushed up on the forehead
	parts.head = new THREE.Group();
	const face = new THREE.Mesh( new THREE.SphereGeometry( 0.12, 16, 12 ).scale( 1, 1.1, 0.95 ), skin );
	const hair = new THREE.Mesh( new THREE.SphereGeometry( 0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55 ), hairMat );
	hair.position.set( - 0.025, 0.02, 0 );
	hair.rotation.z = 0.35;
	const tail = new THREE.Mesh( new THREE.ConeGeometry( 0.05, 0.16, 8 ).rotateZ( Math.PI / 2 + 0.5 ), hairMat );
	tail.position.set( - 0.14, - 0.03, 0 );
	const band = new THREE.Mesh( new THREE.TorusGeometry( 0.128, 0.014, 6, 20 ).rotateX( Math.PI / 2 ), leather );
	band.position.y = 0.06;
	band.rotation.z = - 0.2;
	parts.head.add( face, hair, tail, band );
	for ( const z of [ - 0.045, 0.045 ] ) {

		const rim = new THREE.Mesh( new THREE.TorusGeometry( 0.032, 0.009, 6, 14 ).rotateY( Math.PI / 2 ), brass );
		rim.position.set( 0.11, 0.09, z );
		rim.rotation.z = - 0.5;
		const glass = new THREE.Mesh( new THREE.CircleGeometry( 0.028, 14 ).rotateY( Math.PI / 2 ), lens );
		glass.position.set( 0.113, 0.09, z );
		glass.rotation.z = - 0.5;
		parts.head.add( rim, glass );

	}

	rider.add( parts.pelvis, parts.torso, parts.head );
	for ( const z of [ - 1, 1 ] ) {

		const leg = { z, thigh: new THREE.Mesh( limb( 0.085, 0.07, 0.45 ), trousers ), shin: new THREE.Mesh( limb( 0.065, 0.05, 0.45 ), trousers ) };
		leg.boot = new THREE.Mesh( new THREE.BoxGeometry( 0.24, 0.09, 0.11 ).translate( 0.04, 0.0, 0 ), leather );
		rider.add( leg.thigh, leg.shin, leg.boot );
		parts.legs.push( leg );
		const arm = { z, upper: new THREE.Mesh( limb( 0.06, 0.05, 0.34 ), coat ), fore: new THREE.Mesh( limb( 0.05, 0.04, 0.34 ), coat ) };
		arm.hand = new THREE.Mesh( new THREE.SphereGeometry( 0.045, 10, 8 ), leather );
		rider.add( arm.upper, arm.fore, arm.hand );
		parts.arms.push( arm );

	}
	rider.parts = parts;
	return rider;

}
