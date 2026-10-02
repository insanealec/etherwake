import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, sin, fract, dot, floor, length, max, smoothstep, mix, uv, normalize,
	instanceIndex, cameraPosition, cameraViewMatrix, cameraNear, cameraFar, varyingProperty, vec4,
	viewportLinearDepth, linearDepth, mx_noise_float
} from 'three/tsl';
import { etheriumWaves, cloudColor, PALETTE } from './Etherium.js';

// Cloud puffs heaped on the swell crests: soft, sun-lit billows of nebula gas you surf through. One
// instanced Sprite draw on a world-anchored lattice around the camera (cells recycle as you move). Each
// puff is shaded as a lumpy sphere with the sea's cloud lighting, so the sea and the puffs read as one
// cloud layer; their bottoms melt into the sea (soft depth fade) and the board parts them as it passes.
export const PUFFS = {
	grid: 64, cell: 5, // 64 x 64 puffs, one per 5 m cell
	size: 4, sizeRange: 6, // metres across
	far: 90, // fade-out distance (they thin out well before it, so the far ones don't stack into a wall)
	opacity: 0.45
};

const hash = ( p ) => fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ).mul( 43758.5453 ) );

export class Puffs {

	constructor( scene, sea ) {

		const { grid: GRID, cell: CELL, size, sizeRange, far: FAR } = PUFFS;
		this.sea = sea;
		this.uCamCell = uniform( new THREE.Vector2() );
		this.uBoard = uniform( new THREE.Vector3( 0, - 1000, 0 ) );
		this.uOpacity = uniform( PUFFS.opacity );

		const mat = new THREE.SpriteNodeMaterial( { transparent: true, depthWrite: false } );
		const vFade = varyingProperty( 'float', 'vPuffFade' );
		const vCrest = varyingProperty( 'float', 'vPuffCrest' );
		const vTint = varyingProperty( 'float', 'vPuffTint' );
		const vSeed = varyingProperty( 'float', 'vPuffSeed' );
		const vSize = varyingProperty( 'float', 'vPuffSize' );
		const t = sea.uTime;

		const cellOf = () => {

			const i = float( instanceIndex );
			const iz = floor( i.div( GRID ) );
			return this.uCamCell.add( vec2( i.sub( iz.mul( GRID ) ), iz ).sub( GRID / 2 ) );

		};
		// size: big on the crests, gone in the troughs, so the puffs heap up along the swells
		const crestAt = ( w ) => w.disp.y.div( sea.uMaxAmp );
		const sizeOf = ( cell, crest ) => {

			const h = hash( cell.add( 5.7 ) );
			return h.mul( sizeRange ).add( size ).mul( smoothstep( - 0.6, 0.5, crest.add( h.mul( 0.6 ) ).sub( 0.3 ) ) );

		};

		mat.positionNode = Fn( () => {

			const cell = cellOf();
			const h1 = hash( cell ), h2 = hash( cell.add( 17.3 ) ), h3 = hash( cell.add( 41.9 ) );
			const p = cell.add( vec2( h1, h2 ) ).mul( CELL );
			const w = etheriumWaves( p, sea.uWaves, t, sea.uHeight, cameraPosition.xz );
			const crest = crestAt( w );
			const s = sizeOf( cell, crest );

			// sit mostly above the swell (the soft fade melts their bottoms in), breathing slowly
			const pos = vec3( p.x.add( w.disp.x ), w.disp.y.add( s.mul( 0.28 ) ).add( sin( t.mul( 0.4 ).add( h3.mul( 6.28 ) ) ).mul( 0.3 ) ), p.y.add( w.disp.z ) ).toVar();

			// the board parts the cloud
			const away = pos.sub( this.uBoard );
			const d = length( away );
			const push = smoothstep( s.mul( 0.5 ).add( 3.0 ), 0.0, d );
			pos.addAssign( vec3( away.x, 0.0, away.z ).div( max( d, 0.3 ) ).mul( push.mul( 3.5 ) ) );

			const dist = length( pos.sub( cameraPosition ) );
			vFade.assign( smoothstep( FAR, FAR * 0.25, dist ).mul( smoothstep( 4.0, 14.0, dist ) ) );
			vCrest.assign( crest );
			vTint.assign( mx_noise_float( vec3( pos.xz.mul( 0.005 ), t.mul( 0.02 ) ) ).mul( 0.5 ).add( 0.5 ).clamp() );
			vSeed.assign( h3.mul( 100 ) );
			vSize.assign( s );
			return pos;

		} )();

		mat.scaleNode = Fn( () => {

			const cell = cellOf();
			const p = cell.add( vec2( hash( cell ), hash( cell.add( 17.3 ) ) ) ).mul( CELL );
			const w = etheriumWaves( p, sea.uWaves, t, sea.uHeight, cameraPosition.xz );
			return sizeOf( cell, crestAt( w ) );

		} )();

		// palette lookups as uniforms sharing the PALETTE colours (live tweaks reach the puffs too)
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );

		const shape = Fn( () => {

			// a lumpy sphere: noise erodes the outline into billows, slowly churning
			const q = uv().sub( 0.5 ).mul( 2 );
			const lump = mx_noise_float( vec3( q.mul( 1.8 ), vSeed.add( t.mul( 0.08 ) ) ) ).mul( 0.28 )
				.add( mx_noise_float( vec3( q.mul( 4.5 ), vSeed.add( t.mul( 0.15 ) ) ) ).mul( 0.1 ) );
			const r = length( q ).add( lump );
			const z = max( r.mul( r ).oneMinus(), 0 ).sqrt();
			return vec4( q.x, q.y, z, r );

		} );

		mat.colorNode = Fn( () => {

			const s = shape();
			const Nv = normalize( vec3( s.x, s.y, s.z.add( 0.15 ) ) ); // view-space normal of the billow
			const N = normalize( cameraViewMatrix.transpose().mul( vec4( Nv, 0 ) ).xyz ); // to world
			const V = normalize( cameraViewMatrix.transpose().mul( vec4( 0, 0, 1, 0 ) ).xyz );
			const crest = smoothstep( - 0.3, 0.75, vCrest );
			const col = cloudColor( N, sea.uSunDir, V, crest, vTint, mix( float( 0.6 ), float( 1 ), s.z ), c );
			// thin, translucent edges glow a little: the outline of each billow catches the light
			const rim = smoothstep( 0.55, 0.95, s.w ).mul( 0.35 );
			return sea.regionTint( col.add( mix( c( 'cloudLitA' ), c( 'cloudLitB' ), vTint ).mul( rim ) ) );

		} )();

		mat.opacityNode = Fn( () => {

			const s = shape();
			const edge = smoothstep( 1.0, 0.55, s.w );
			// soft bottom: fade where the puff meets the sea (or anything) behind it
			const gap = viewportLinearDepth.sub( linearDepth() ).mul( cameraFar.sub( cameraNear ) );
			const soft = smoothstep( 0.0, vSize.mul( 0.35 ).add( 0.5 ), gap );
			return edge.mul( soft ).mul( vFade ).mul( this.uOpacity );

		} )();

		this.mesh = new THREE.Sprite( mat );
		this.mesh.count = GRID * GRID;
		this.mesh.frustumCulled = false;
		this.mesh.renderOrder = 1;
		scene.add( this.mesh );

	}

	update( camera, surfer ) {

		this.uCamCell.value.set( Math.floor( camera.position.x / PUFFS.cell ), Math.floor( camera.position.z / PUFFS.cell ) );
		if ( surfer ) this.uBoard.value.copy( surfer.position );

	}

}
