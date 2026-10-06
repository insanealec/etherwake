import * as THREE from 'three/webgpu';
import { Fn, vec3, vec4, dot, log, uv, texture } from 'three/tsl';

// Auto exposure (graphics pass 3, slice 5): like an eye or a camera, the exposure drifts so the scene's
// average brightness stays near a target: down when you look into the low sun, up over shadowed cloud.
// Every few frames, right after the frame, a 32x18 thumbnail of the scene's log luminance is rendered
// (saving and restoring the renderer's state, as three's own passes do) and read back asynchronously
// (it never stalls a frame); the factor multiplies the region's look exposure. Gentle by design: a
// square-root response within min..max. ?noAutoExposure turns it off.
// (Not an rtt() node: one only reachable through a dummy term in the output rendered once and froze.)
export const EXPOSURE = {
	grid: [ 32, 18 ],
	every: 6, // frames between measurements
	key: 0.11, // the average luminance (linear, before tone mapping) that gets factor 1: the open sea
	response: 0.5, // 1: fully compensate, 0: no adaptation
	min: 0.7, max: 1.35,
	rate: 1.5 // adaptation speed (1/s)
};

const LUMA = [ 0.2126, 0.7152, 0.0722 ];
const half = ( h ) => {

	const s = ( h & 0x8000 ) ? - 1 : 1, e = ( h >> 10 ) & 31, f = h & 1023;
	return e === 0 ? s * Math.pow( 2, - 14 ) * f / 1024 : e === 31 ? NaN : s * Math.pow( 2, e - 15 ) * ( 1 + f / 1024 );

};

export class AutoExposure {

	// scene: a texture node of the frame's linear colour (its texture is sampled directly: sampling the
	// node from another material cloned it, and the clone rendered a stale copy)
	constructor( scene ) {

		const source = texture( scene.value );

		const [ w, h ] = EXPOSURE.grid;
		this.target = new THREE.RenderTarget( w, h, { type: THREE.HalfFloatType, depthBuffer: false } );
		const mat = new THREE.MeshBasicNodeMaterial( { fog: false } );
		mat.colorNode = Fn( () => {

			const l = dot( source.sample( uv() ).rgb.max( 0 ), vec3( ...LUMA ) );
			return vec4( log( l.add( 1e-3 ) ).add( 10 ), 0, 0, 1 ); // +10: the material output clamps negatives

		} )();
		this.quad = new THREE.QuadMesh( mat );
		this.state = undefined; // (resetRendererState creates it; it rejects null)
		this.factor = 1;
		this.average = EXPOSURE.key;
		this.frames = 0;
		this.pending = false;

	}

	// after the frame: now and then measure it
	measure( renderer ) {

		const E = EXPOSURE;
		if ( ++ this.frames % E.every !== 0 || this.pending ) return;
		const { resetRendererState, restoreRendererState } = THREE.RendererUtils;
		this.state = resetRendererState( renderer, this.state );
		renderer.setRenderTarget( this.target );
		this.quad.render( renderer );
		restoreRendererState( renderer, this.state );

		this.pending = true;
		const [ w, h ] = E.grid;
		renderer.readRenderTargetPixelsAsync( this.target, 0, 0, w, h ).then( ( b ) => {

			let sum = 0, n = 0;
			for ( let i = 0; i < b.length; i += 4 ) {

				const v = ( b instanceof Uint16Array ? half( b[ i ] ) : b[ i ] ) - 10;
				if ( Number.isFinite( v ) ) {

					sum += v;
					n ++;

				}

			}
			if ( n ) this.average = Math.exp( sum / n );
			this.pending = false;

		} ).catch( () => {

			this.pending = false;

		} );

	}

	// the exposure factor, easing toward the target
	update( dt ) {

		const E = EXPOSURE;
		const target = Math.min( E.max, Math.max( E.min, Math.pow( E.key / Math.max( this.average, 1e-4 ), E.response ) ) );
		this.factor += ( target - this.factor ) * ( 1 - Math.exp( - E.rate * dt ) );
		return this.factor;

	}

}
