import * as THREE from 'three/webgpu';

// A person built from shaped primitives, in the same style as the surfer's rider (player/SurferModel.js):
// tapered coat with belt, buckle and collar, trousers, boots, hair, optional hat or flight goggles.
// Shared by the walker, the NPCs and the galleon's crew. Returns a Group with `legs` and `arms` (hip and
// shoulder pivots, swung by animateFigure) and `knees`; the feet are at y = 0, facing +z.
export function buildFigure( { coat = 0x2c4a6b, skin = 0xc98f6a, hat = null, hair = 0x3a2214, goggles = false, height = 1 } = {} ) {

	const coatMat = new THREE.MeshStandardNodeMaterial( { color: coat, roughness: 0.75 } );
	const trousers = new THREE.MeshStandardNodeMaterial( { color: 0x3a2e28, roughness: 0.85 } );
	const leather = new THREE.MeshStandardNodeMaterial( { color: 0x2a1a10, roughness: 0.6 } );
	const face = new THREE.MeshStandardNodeMaterial( { color: skin, roughness: 0.7 } );
	const brass = new THREE.MeshStandardNodeMaterial( { color: 0xc8963f, metalness: 0.9, roughness: 0.3 } );

	const fig = new THREE.Group();

	// torso: a coat tapering from the shoulders to the hips, with skirts, a belt and a collar
	const torso = new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0.16, 0.56, 12 ).scale( 1, 1, 0.72 ), coatMat );
	torso.position.y = 1.2;
	const skirt = new THREE.Mesh( new THREE.CylinderGeometry( 0.17, 0.22, 0.22, 12, 1, true ).scale( 1, 1, 0.8 ), coatMat );
	skirt.material = coatMat.clone();
	skirt.material.side = THREE.DoubleSide;
	skirt.position.y = 0.86;
	const belt = new THREE.Mesh( new THREE.TorusGeometry( 0.165, 0.022, 6, 16 ).rotateX( Math.PI / 2 ).scale( 1, 1, 0.75 ), leather );
	belt.position.y = 0.97;
	const buckle = new THREE.Mesh( new THREE.BoxGeometry( 0.06, 0.05, 0.02 ), brass );
	buckle.position.set( 0, 0.97, 0.125 );
	const collar = new THREE.Mesh( new THREE.TorusGeometry( 0.1, 0.035, 6, 14 ).rotateX( Math.PI / 2 ), coatMat );
	collar.position.y = 1.48;
	fig.add( torso, skirt, belt, buckle, collar );

	// head: face, swept hair and a short tail; goggles on the forehead or a hat
	const head = new THREE.Group();
	head.position.y = 1.64;
	const faceMesh = new THREE.Mesh( new THREE.SphereGeometry( 0.12, 16, 12 ).scale( 0.95, 1.1, 1 ), face );
	const hairMesh = new THREE.Mesh( new THREE.SphereGeometry( 0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55 ), new THREE.MeshStandardNodeMaterial( { color: hair, roughness: 0.9 } ) );
	hairMesh.position.set( 0, 0.02, - 0.025 );
	hairMesh.rotation.x = - 0.35;
	head.add( faceMesh, hairMesh );
	if ( goggles ) {

		const lens = new THREE.MeshStandardNodeMaterial( { color: 0x40200a, emissive: 0xff8a30, emissiveIntensity: 0.6, roughness: 0.2 } );
		const band = new THREE.Mesh( new THREE.TorusGeometry( 0.128, 0.014, 6, 20 ).rotateX( Math.PI / 2 ), leather );
		band.position.y = 0.06;
		band.rotation.x = 0.2;
		head.add( band );
		for ( const x of [ - 0.045, 0.045 ] ) {

			const rim = new THREE.Mesh( new THREE.TorusGeometry( 0.032, 0.009, 6, 14 ), brass );
			rim.position.set( x, 0.09, 0.11 );
			rim.rotation.x = 0.5;
			const glass = new THREE.Mesh( new THREE.CircleGeometry( 0.028, 14 ), lens );
			glass.position.set( x, 0.09, 0.113 );
			glass.rotation.x = 0.5;
			head.add( rim, glass );

		}

	}
	if ( hat !== null ) {

		const hatMat = new THREE.MeshStandardNodeMaterial( { color: hat, roughness: 0.6 } );
		const brim = new THREE.Mesh( new THREE.CylinderGeometry( 0.26, 0.26, 0.025, 18 ), hatMat );
		brim.position.y = 0.1;
		brim.rotation.x = - 0.08;
		const crown = new THREE.Mesh( new THREE.CylinderGeometry( 0.13, 0.15, 0.17, 16 ), hatMat );
		crown.position.y = 0.19;
		const band = new THREE.Mesh( new THREE.CylinderGeometry( 0.152, 0.152, 0.035, 16 ), brass );
		band.position.y = 0.13;
		head.add( brim, crown, band );

	}
	fig.add( head );
	fig.head = head;

	// legs (hip pivots, a knee pivot each) and arms (shoulder pivots)
	fig.legs = [];
	fig.knees = [];
	fig.arms = [];
	const limb = ( r0, r1, len ) => new THREE.CylinderGeometry( r1, r0, len, 10 ).translate( 0, - len / 2, 0 ); // hangs down from its pivot
	for ( const side of [ - 1, 1 ] ) {

		const hip = new THREE.Group();
		hip.position.set( side * 0.09, 0.92, 0 );
		const thigh = new THREE.Mesh( limb( 0.085, 0.07, 0.44 ), trousers );
		const knee = new THREE.Group();
		knee.position.y = - 0.44;
		const shin = new THREE.Mesh( limb( 0.065, 0.055, 0.4 ), trousers );
		const boot = new THREE.Mesh( new THREE.BoxGeometry( 0.11, 0.09, 0.24 ).translate( 0, - 0.43, 0.04 ), leather );
		knee.add( shin, boot );
		hip.add( thigh, knee );
		fig.add( hip );
		fig.legs.push( hip );
		fig.knees.push( knee );

		const shoulder = new THREE.Group();
		shoulder.position.set( side * 0.24, 1.43, 0 );
		shoulder.rotation.z = side * 0.08;
		const upper = new THREE.Mesh( limb( 0.06, 0.05, 0.3 ), coatMat );
		const fore = new THREE.Mesh( limb( 0.05, 0.042, 0.28 ).translate( 0, - 0.3, 0 ), coatMat );
		const cuff = new THREE.Mesh( new THREE.CylinderGeometry( 0.055, 0.055, 0.05, 10 ), brass );
		cuff.position.y = - 0.55;
		const hand = new THREE.Mesh( new THREE.SphereGeometry( 0.045, 10, 8 ), leather );
		hand.position.y = - 0.62;
		shoulder.add( upper, fore, cuff, hand );
		fig.add( shoulder );
		fig.arms.push( shoulder );

	}

	fig.scale.setScalar( height );
	return fig;

}

// Swing legs and arms for a walk cycle; phase advances with distance walked, amount 0..1.
// The knee bends as each leg swings through.
export function animateFigure( fig, phase, amount ) {

	const s = Math.sin( phase ) * 0.6 * amount;
	fig.legs[ 0 ].rotation.x = s;
	fig.legs[ 1 ].rotation.x = - s;
	fig.knees[ 0 ].rotation.x = Math.max( 0, - Math.cos( phase ) ) * 0.9 * amount;
	fig.knees[ 1 ].rotation.x = Math.max( 0, Math.cos( phase ) ) * 0.9 * amount;
	fig.arms[ 0 ].rotation.x = - s * 0.8;
	fig.arms[ 1 ].rotation.x = s * 0.8;

}
