import * as THREE from 'three/webgpu';
import {
	Fn, uniform, vec2, vec3, length, smoothstep, mix, positionGeometry, attribute, round,
	cameraPosition, varyingProperty, mx_fractal_noise_float
} from 'three/tsl';
import { etheriumWaves, PALETTE } from './Etherium.js';

// Gas shells: faint, patchy, additive copies of the swell surface floating above it, so the
// etherium reads as a thick layer you ride through (knee to waist deep) rather than a skin.
// Each shell drifts at its own speed for parallax. Coarser grid and cheaper noise than the sea.
export const SHELLS = {
	heights: [ 0.7, 1.6, 2.7, 4.0 ], // metres above the surface: the gas frays upward off the crests
	strength: 0.3, // brightness of the lowest shell; higher shells are fainter
	segments: 256
};

export class Shells {

	constructor( scene, sea ) {

		this.sea = sea;
		this.meshes = [];
		this.uStrength = uniform( SHELLS.strength );
		const geo = sea.buildGeometry( SHELLS.segments );
		SHELLS.heights.forEach( ( h, i ) => {

			const mesh = new THREE.Mesh( geo, this.material( h, i ) );
			mesh.frustumCulled = false;
			mesh.renderOrder = 1;
			scene.add( mesh );
			this.meshes.push( mesh );

		} );

	}

	set visible( v ) {

		for ( const m of this.meshes ) m.visible = v;

	}

	get visible() {

		return this.meshes[ 0 ].visible;

	}

	// follow the sea grid's snapped position (the shaders work in world space via sea.uOffset)
	update() {

		for ( const m of this.meshes ) m.position.copy( this.sea.mesh.position );

	}

	material( height, index ) {

		const sea = this.sea;
		const mat = new THREE.MeshBasicNodeMaterial( {
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
		} );
		const vWorld = varyingProperty( 'vec3', 'vShellWorld' );
		const vCrest = varyingProperty( 'float', 'vShellCrest' );

		mat.positionNode = Fn( () => {

			const step = attribute( 'snapStep', 'vec2' );
			const p = round( positionGeometry.xz.add( sea.uOffset ).div( step ) ).mul( step ).toVar();
			const w = etheriumWaves( p, sea.uWaves, sea.uTime, sea.uHeight, cameraPosition.xz );
			vWorld.assign( vec3( p.x.add( w.disp.x ), w.disp.y.add( height ), p.y.add( w.disp.z ) ) );
			vCrest.assign( w.disp.y.div( sea.uMaxAmp ) );
			return vec3( p.x.sub( sea.uOffset.x ), height, p.y.sub( sea.uOffset.y ) ).add( w.disp );

		} )();

		const col = ( k ) => vec3( PALETTE[ k ].r, PALETTE[ k ].g, PALETTE[ k ].b );
		const drift = vec2( 1.6, 0.4 ).mul( 1.0 + index * 0.6 ); // upper shells drift faster: parallax
		const strength = this.uStrength.mul( Math.pow( 0.7, index ) );

		mat.colorNode = Fn( () => {

			const t = sea.uTime;
			const P = vWorld;
			const q = P.xz.sub( drift.mul( t ) ).add( index * 37.0 );

			// patchy wisps: most of each shell is empty, so you see through it
			const n = mx_fractal_noise_float( vec3( q.mul( 0.045 ), t.mul( 0.06 ) ), 3, 2.0, 0.55 ).mul( 0.5 ).add( 0.5 );
			const dens = smoothstep( 0.45, 0.8, n );

			const crest = smoothstep( - 0.3, 0.8, vCrest );
			const c = mix( mix( col( 'troughB' ), col( 'troughA' ), dens ), mix( col( 'crestB' ), col( 'crestA' ), dens ), crest );

			// fade near the camera (no screen-filling blobs) and far away (avoid a bright horizon band)
			const d = length( cameraPosition.sub( P ) );
			const fade = smoothstep( 1.5, 9.0, d ).mul( smoothstep( 700.0, 250.0, d ) );
			return c.mul( dens ).mul( fade ).mul( strength ).mul( crest.mul( 1.5 ).add( 0.6 ) );

		} )();

		return mat;

	}

}
