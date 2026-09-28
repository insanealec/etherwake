import * as THREE from 'three/webgpu';

// A simple primitive person (body, head, legs, arms) shared by the walker and the NPCs.
// Returns a Group with `legs` and `arms` arrays for a walk cycle; the feet are at y = 0, facing +z.
export function buildFigure( { coat = 0x2c4a6b, skin = 0xc98f6a, hat = null, height = 1 } = {} ) {

	const cloth = new THREE.MeshStandardNodeMaterial( { color: coat, roughness: 0.8 } );
	const face = new THREE.MeshStandardNodeMaterial( { color: skin, roughness: 0.7 } );

	const fig = new THREE.Group();
	const body = new THREE.Mesh( new THREE.CapsuleGeometry( 0.22, 0.55, 4, 10 ), cloth );
	body.position.y = 1.2;
	const head = new THREE.Mesh( new THREE.SphereGeometry( 0.16, 14, 10 ), face );
	head.position.y = 1.74;
	fig.add( body, head );

	fig.legs = [];
	fig.arms = [];
	const legGeo = new THREE.CapsuleGeometry( 0.08, 0.6, 3, 8 );
	legGeo.translate( 0, - 0.38, 0 ); // pivot at the hip
	const armGeo = new THREE.CapsuleGeometry( 0.06, 0.5, 3, 8 );
	armGeo.translate( 0, - 0.3, 0 ); // pivot at the shoulder
	for ( const side of [ - 1, 1 ] ) {

		const leg = new THREE.Mesh( legGeo, cloth );
		leg.position.set( side * 0.11, 0.84, 0 );
		const arm = new THREE.Mesh( armGeo, cloth );
		arm.position.set( side * 0.3, 1.48, 0 );
		fig.add( leg, arm );
		fig.legs.push( leg );
		fig.arms.push( arm );

	}

	if ( hat !== null ) {

		const hatMat = new THREE.MeshStandardNodeMaterial( { color: hat, roughness: 0.6 } );
		const brim = new THREE.Mesh( new THREE.CylinderGeometry( 0.28, 0.28, 0.03, 16 ), hatMat );
		brim.position.y = 1.86;
		const crown = new THREE.Mesh( new THREE.CylinderGeometry( 0.15, 0.17, 0.2, 16 ), hatMat );
		crown.position.y = 1.97;
		fig.add( brim, crown );

	}

	fig.scale.setScalar( height );
	return fig;

}

// Swing legs and arms for a walk cycle; phase advances with distance walked, amount 0..1.
export function animateFigure( fig, phase, amount ) {

	const s = Math.sin( phase ) * 0.6 * amount;
	fig.legs[ 0 ].rotation.x = s;
	fig.legs[ 1 ].rotation.x = - s;
	fig.arms[ 0 ].rotation.x = - s * 0.8;
	fig.arms[ 1 ].rotation.x = s * 0.8;

}
