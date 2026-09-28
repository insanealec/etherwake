import * as THREE from 'three/webgpu';
import { attribute, vec3, sin, uv, smoothstep, positionWorld, mx_noise_float } from 'three/tsl';

const POINTS = 72; // trail length in samples
const EVERY = 0.035; // seconds between samples
const LIFE = POINTS * EVERY;

// Glowing wake ribbon laid on the etherium behind the board. Each sample remembers where the
// board was; every frame the strip is re-draped on the moving surface, widens and fades.
export class Wake {

	constructor( scene, sea ) {

		this.sea = sea;
		this.samples = []; // { x, z, px, pz (unit sideways), age, strength }
		this.clock = 0;

		const geo = new THREE.BufferGeometry();
		this.positions = new THREE.BufferAttribute( new Float32Array( POINTS * 2 * 3 ), 3 ).setUsage( THREE.DynamicDrawUsage );
		this.fade = new THREE.BufferAttribute( new Float32Array( POINTS * 2 ), 1 ).setUsage( THREE.DynamicDrawUsage );
		const uvs = new Float32Array( POINTS * 2 * 2 );
		const index = [];
		for ( let i = 0; i < POINTS; i ++ ) {

			uvs.set( [ 0, i / ( POINTS - 1 ), 1, i / ( POINTS - 1 ) ], i * 4 );
			if ( i < POINTS - 1 ) {

				const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
				index.push( a, c, b, b, c, d );

			}

		}
		geo.setAttribute( 'position', this.positions );
		geo.setAttribute( 'fade', this.fade );
		geo.setAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );
		geo.setIndex( index );

		const mat = new THREE.MeshBasicNodeMaterial( {
			transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
		} );
		// soft edges, broken up into foamy streaks by world-space noise
		const across = sin( uv().x.mul( Math.PI ) );
		const foam = smoothstep( - 0.2, 0.6, mx_noise_float( positionWorld.xz.mul( 0.9 ) ) );
		mat.colorNode = vec3( 1.0, 0.42, 0.10 ).mul( attribute( 'fade', 'float' ) ).mul( across.pow( 2 ) ).mul( foam.mul( 0.8 ).add( 0.2 ) ).mul( 0.9 );

		this.mesh = new THREE.Mesh( geo, mat );
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 1;
		scene.add( this.mesh );

	}

	update( dt, surfer ) {

		for ( const s of this.samples ) s.age += dt;
		while ( this.samples.length && this.samples[ this.samples.length - 1 ].age > LIFE ) this.samples.pop();

		this.clock += dt;
		if ( this.clock >= EVERY ) {

			this.clock = 0;
			const v = surfer.velocity, speed = surfer.speed;
			const px = speed > 0.1 ? - v.z / speed : 1, pz = speed > 0.1 ? v.x / speed : 0;
			// strength: 0 in the air (breaks the ribbon), rising with speed
			const strength = surfer.grounded ? Math.min( 1, speed / 18 ) : 0;
			this.samples.unshift( { x: surfer.position.x, z: surfer.position.z, px, pz, age: 0, strength } );
			if ( this.samples.length > POINTS ) this.samples.pop();

		}

		const pos = this.positions.array, fade = this.fade.array;
		const last = this.samples[ this.samples.length - 1 ];
		for ( let i = 0; i < POINTS; i ++ ) {

			// unused tail slots collapse onto the oldest sample with zero fade
			const s = this.samples[ i ] || last;
			if ( ! s ) break;
			const life = s.age / LIFE;
			const width = 0.35 + life * 2.2;
			const y = this.sea.heightAt( s.x, s.z ) + 0.04;
			const f = this.samples[ i ] ? s.strength * ( 1 - life ) * ( 1 - life ) : 0;
			pos.set( [ s.x - s.px * width, y, s.z - s.pz * width, s.x + s.px * width, y, s.z + s.pz * width ], i * 6 );
			fade[ i * 2 ] = fade[ i * 2 + 1 ] = f;

		}
		this.positions.needsUpdate = true;
		this.fade.needsUpdate = true;

	}

}
