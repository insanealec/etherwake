import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec4, uv, texture } from 'three/tsl';
import { etheriumWaves } from './Etherium.js';

// The sea's height as a texture around the camera, re-rendered every frame: the swell (Gerstner waves
// solved back to the world point, as Etherium.heightAt does) plus the bow waves, flare-fronts and ring
// waves. Shaders that need the surface at arbitrary points (the volumetric etherium) sample this
// instead of re-running the wave sum. `node( xz )` returns the height at world xz (metres).
export const SEA_HEIGHT = { size: 512, res: 512 }; // metres covered, texels

export class SeaHeight {

	constructor( sea ) {

		const { size, res } = SEA_HEIGHT;
		this.sea = sea;
		this.texel = size / res;
		this.uCenter = uniform( new THREE.Vector2() );
		this.target = new THREE.RenderTarget( res, res, { type: THREE.HalfFloatType, depthBuffer: false } );
		this.target.texture.minFilter = this.target.texture.magFilter = THREE.LinearFilter;

		const mat = new THREE.MeshBasicNodeMaterial( { fog: false } );
		mat.colorNode = Fn( () => {

			const xz = this.uCenter.add( uv().sub( 0.5 ).mul( size ) ).toVar();
			// the waves move points sideways too: two fixed-point steps find the grid point that lands here
			const p = xz.toVar();
			for ( let i = 0; i < 2; i ++ ) {

				const w = etheriumWaves( p, sea.uWaves, sea.uTime, sea.uHeight, this.uCenter );
				p.assign( xz.sub( vec2( w.disp.x, w.disp.z ) ) );

			}
			const w = etheriumWaves( p, sea.uWaves, sea.uTime, sea.uHeight, this.uCenter );
			return vec4( w.disp.y, 0, 0, 1 );

		} )();
		this.quad = new THREE.QuadMesh( mat );
		this.tex = texture( this.target.texture );

	}

	// re-render around the camera (snapped to whole texels so it doesn't shimmer)
	update( renderer, camera ) {

		const t = this.texel;
		this.uCenter.value.set( Math.round( camera.position.x / t ) * t, Math.round( camera.position.z / t ) * t );
		const prev = renderer.getRenderTarget();
		renderer.setRenderTarget( this.target );
		this.quad.render( renderer );
		renderer.setRenderTarget( prev );

	}

	// TSL: the height at world xz (sampled without mip selection, so it's safe inside loops)
	node( xz ) {

		return this.tex.sample( xz.sub( this.uCenter ).div( SEA_HEIGHT.size ).add( 0.5 ) ).level( 0 ).r;

	}

}
