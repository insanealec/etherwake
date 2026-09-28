import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, sin, cos, fract, dot, floor, length, max, smoothstep, mix, uv,
	instanceIndex, cameraPosition, varyingProperty
} from 'three/tsl';
import { etheriumWaves, PALETTE } from './Etherium.js';

// Layers: GRID x GRID motes, one per world cell of CELL metres; FAR is the fade-out distance.
// The wide layer fills the view; the near layer is small, dense motes right around the camera.
export const MOTE_LAYERS = {
	wide: { grid: 256, cell: 1.4, far: 150, size: 0.1, sizeRange: 0.18, seed: 0 },
	near: { grid: 128, cell: 0.5, far: 30, size: 0.04, sizeRange: 0.08, seed: 91.7 }
};

const hash = ( p ) => fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ).mul( 43758.5453 ) );

// Glowing motes of etherium hanging in a band just above the swell: the "gas" you surf through.
// One instanced Sprite draw; each mote's spot comes from its index on a world-anchored lattice
// around the camera (cells recycle as you move, so motes never swim), riding the same waves as the
// sea (etheriumWaves). They rise and fade in slow cycles, wobble, and get shoved aside by the board.
export class Motes {

	constructor( scene, sea, { grid: GRID, cell: CELL, far: FAR, size, sizeRange, seed } = MOTE_LAYERS.wide ) {

		this.sea = sea;
		this.cell = CELL;
		this.uCamCell = uniform( new THREE.Vector2() );
		this.uBoard = uniform( new THREE.Vector3( 0, - 1000, 0 ) );

		const mat = new THREE.SpriteNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } );
		const vFade = varyingProperty( 'float', 'vMoteFade' );
		const vTint = varyingProperty( 'vec3', 'vMoteTint' );
		const t = sea.uTime;

		mat.positionNode = Fn( () => {

			const i = float( instanceIndex );
			const iz = floor( i.div( GRID ) );
			const ix = i.sub( iz.mul( GRID ) );
			const cell = this.uCamCell.add( vec2( ix, iz ).sub( GRID / 2 ) ).add( seed );
			const h1 = hash( cell ), h2 = hash( cell.add( 17.3 ) ), h3 = hash( cell.add( 41.9 ) ), h4 = hash( cell.add( 73.1 ) );

			const p = cell.sub( seed ).add( vec2( h1, h2 ) ).mul( CELL );
			const w = etheriumWaves( p, sea.uWaves, t, sea.uHeight, cameraPosition.xz );

			// life cycle: rise ~1.5 m and fade in/out, each mote on its own clock
			const phase = fract( t.mul( h3.mul( 0.12 ).add( 0.06 ) ).add( h4 ) );
			const lift = h3.mul( 1.6 ).add( 0.2 ).add( phase.mul( 1.5 ) );
			const wob = vec2( sin( t.mul( 0.7 ).add( h1.mul( 6.28 ) ) ), cos( t.mul( 0.55 ).add( h2.mul( 6.28 ) ) ) ).mul( 0.45 );
			const pos = vec3( p.x.add( w.disp.x ).add( wob.x ), w.disp.y.add( lift ), p.y.add( w.disp.z ).add( wob.y ) ).toVar();

			// the board shoves nearby motes aside and up
			const away = pos.sub( this.uBoard );
			const d = length( away );
			const push = smoothstep( 4.5, 0.0, d );
			pos.addAssign( vec3( away.x, 0.0, away.z ).div( max( d, 0.3 ) ).mul( push.mul( 3.0 ) ).add( vec3( 0, push.mul( 1.5 ), 0 ) ) );

			const dist = length( pos.sub( cameraPosition ) );
			const crest = w.disp.y.div( sea.uMaxAmp ).mul( 0.5 ).add( 0.5 ).clamp();
			vFade.assign( sin( phase.mul( Math.PI ) ).mul( smoothstep( FAR, FAR * 0.6, dist ) ).mul( smoothstep( 1.0, 4.0, dist ) ).mul( crest.mul( 1.2 ).add( 0.35 ) ) );

			// colour: mostly gold and rose, some teal
			const warm = mix( vec3( PALETTE.crestA.r, PALETTE.crestA.g, PALETTE.crestA.b ), vec3( PALETTE.crestB.r, PALETTE.crestB.g, PALETTE.crestB.b ), h2 );
			vTint.assign( mix( warm, vec3( 0.1, 0.7, 1.0 ), h4.greaterThan( 0.8 ).select( float( 1 ), float( 0 ) ) ) );
			return pos;

		} )();

		mat.scaleNode = Fn( () => {

			const cell = this.uCamCell.add( vec2( float( instanceIndex ).mod( GRID ), floor( float( instanceIndex ).div( GRID ) ) ) );
			return hash( cell.add( 5.7 ) ).mul( sizeRange ).add( size );

		} )();

		const soft = smoothstep( 0.5, 0.0, length( uv().sub( 0.5 ) ) );
		mat.colorNode = vTint.mul( 1.4 );
		mat.opacityNode = soft.mul( soft ).mul( vFade );

		this.mesh = new THREE.Sprite( mat );
		this.mesh.count = GRID * GRID;
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 1;
		scene.add( this.mesh );

	}

	update( camera, surfer ) {

		this.uCamCell.value.set( Math.floor( camera.position.x / this.cell ), Math.floor( camera.position.z / this.cell ) );
		if ( surfer ) this.uBoard.value.copy( surfer.position );

	}

}
