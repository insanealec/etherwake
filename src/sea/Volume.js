import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, vec4, Loop, If, Break, screenUV, screenCoordinate, cameraPosition,
	cameraWorldMatrix, cameraProjectionMatrixInverse, getViewPosition, texture3D, smoothstep, mix, max,
	min, exp, dot, normalize, length, fract, rtt, pow
} from 'three/tsl';
import { PALETTE, cloudColor } from './Etherium.js';
import { cloudNoiseTexture } from './CloudNoise.js';

// The volumetric etherium (graphics pass 3, slice 2): near the camera the cloud sea is raymarched as real
// 3D gas instead of drawn as a surface. Density: everything below the swell (SeaHeight's texture) is
// thick cloud, and a band above it is billowy cumulus carved from tileable Perlin-Worley noise
// (CloudNoise.js) and frayed by finer detail. Each sample takes a few steps toward the sun for
// self-shadowing (bright tops, shaded folds, a silver lining against the light), plus sky light from
// above and the crest colours glowing from inside. Rendered at reduced resolution with a jittered start
// (TRAA in App blends the jitter away), stopped by the scene's depth (the board, ships and port), and
// faded out by VOLUME.range, where the sea mesh takes over. Opt-in with ?volume (work in progress);
// ?volDebug shows the raw noise (r, g) and the density 30 m out (b).
export const VOLUME = {
	range: 220, // metres of raymarched sea; the mesh is drawn beyond (it fades out from 0.65 of this)
	steps: 72, // samples per ray (at most)
	minStep: 0.25, // metres; steps grow with distance (stepGrowth of the distance travelled)
	stepGrowth: 0.045,
	lightSteps: [ 0.4, 1.3, 3.0 ], // distances toward the sun of the shadow samples (m)
	lightDensity: 0.3, // extinction scale for sunlight (lower: light reaches deeper into the billows)
	sun: 0.5, // extra forward-scattered sunlight looking toward the sun
	normalStep: 0.4, // metres, for the density gradient
	top: 3.0, // the billows reach this far above the swell (m)
	cameraClear: 4.8, // the chase camera keeps this far above the swell, above the billows (App)
	solid: 2.5, // solid cloud from this deep below the swell (m)
	baseScale: 16, // metres per tile of the billow noise
	detailScale: 7, // metres per tile of the detail noise
	erode: 0.4, // how much the detail eats the billows' edges
	density: 4, // extinction per metre at full density (high: cloud tops with crisp silhouettes)
	drift: [ 0.9, 0.12, 0.25 ], // m/s, the billows' slow flow
	forward: 0.55, // forward scattering (silver lining) strength
	tunnel: 3.5, // radius of the clear view from the camera to the board (m)
	resolution: 0.5 // of the screen
};

const DEBUG = new URLSearchParams( location.search ).has( 'volDebug' );

export class Volume {

	// sea: Etherium; seaHeight: SeaHeight; depthNode: the scene pass's depth texture node
	constructor( sea, seaHeight, depthNode ) {

		const V = VOLUME;
		this.uBoard = uniform( new THREE.Vector3( 0, - 1000, 0 ) );
		this.uFrame = uniform( 0 );
		const noise = cloudNoiseTexture( 64 );
		const t = sea.uTime;
		const L = sea.uSunDir;
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );

		// density at world point p (0..1), plus the swell height there (for the crest glow)
		const densityAt = ( p ) => {

			const surf = seaHeight.node( p.xz );
			const h = p.y.sub( surf );
			const coverage = smoothstep( V.top, - 0.6, h ); // 1 under the swell, 0 at the top of the band
			const flow = vec3( ...V.drift ).mul( t );
			const base = smoothstep( 0.3, 0.78, texture3D( noise, p.sub( flow ).div( V.baseScale ) ).level( 0 ).r ); // stretched: the noise sits mid-range
			const billow = base.sub( coverage.oneMinus() ).div( coverage.max( 0.001 ) ).clamp(); // remap by coverage
			const detail = texture3D( noise, p.sub( flow.mul( 1.6 ) ).div( V.detailScale ) ).level( 0 ).g;
			const shaped = smoothstep( 0.05, 0.35, billow.sub( detail.mul( V.erode ).mul( billow.oneMinus() ) ) ); // firm edges, wispy fringe
			const solid = smoothstep( - 0.4, - V.solid, h ); // thick below
			// the board parts the gas, and a tunnel stays clear from the camera to the board so the view is
			// never smothered (the chase camera rides inside the billow band)
			const ab = this.uBoard.sub( cameraPosition );
			const along = p.sub( cameraPosition ).dot( ab ).div( ab.dot( ab ).max( 1e-3 ) ).clamp();
			const tunnel = length( p.sub( cameraPosition.add( ab.mul( along ) ) ) );
			const carve = smoothstep( 1.0, 3.2, length( p.sub( this.uBoard ) ) ).mul( smoothstep( V.tunnel * 0.4, V.tunnel, tunnel ) );
			return { d: max( shaped, solid ).mul( carve ), surf, h };

		};

		const march = Fn( () => {

			// the ray from the camera through this pixel, to whatever the scene drew there (or the sky)
			const depth = depthNode.sample( screenUV ).level( 0 ).r;
			const viewPos = getViewPosition( screenUV, depth, cameraProjectionMatrixInverse );
			const world = cameraWorldMatrix.mul( vec4( viewPos, 1 ) ).xyz;
			const ro = cameraPosition;
			const toScene = world.sub( ro );
			const rd = normalize( toScene );
			const tScene = depth.greaterThanEqual( 0.9999 ).select( float( 1e6 ), length( toScene ) );

			// clip to the slab the cloud lives in (the swell's range plus the billow band) and to the range
			const yTop = sea.uMaxAmp.mul( 1.6 ).add( V.top + 2 ), yBot = sea.uMaxAmp.mul( - 1.6 ).sub( V.solid + 4 );
			const inv = float( 1 ).div( rd.y.abs().max( 1e-4 ).mul( rd.y.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );
			const ta = yTop.sub( ro.y ).mul( inv ), tb = yBot.sub( ro.y ).mul( inv );
			const t0 = max( min( ta, tb ), 0 ), t1 = min( min( max( ta, tb ), tScene ), V.range );

			const S = vec3( 0 ).toVar(); // light scattered toward the camera
			const T = float( 1 ).toVar(); // transmittance
			If( t1.greaterThan( t0 ), () => {

				// jittered start (interleaved gradient noise, new each frame): TRAA averages the banding away
				const ign = fract( fract( dot( screenCoordinate.xy.add( this.uFrame.mul( 5.588238 ) ), vec2( 0.06711056, 0.00583715 ) ) ).mul( 52.9829189 ) );
				const tt = t0.add( max( t0.mul( V.stepGrowth ), V.minStep ).mul( ign ) ).toVar();
				const cosTheta = dot( rd, L );
				// phase: isotropic plus a forward lobe (Henyey-Greenstein, g = 0.6) for the silver lining
				const g = 0.6;
				const hg = float( 1 - g * g ).div( pow( float( 1 + g * g ).sub( cosTheta.mul( 2 * g ) ), 1.5 ) ).mul( 1 / ( 4 * Math.PI ) );
				const phase = mix( float( 1 / ( 4 * Math.PI ) ), hg, V.forward ).mul( 4 * Math.PI );

				Loop( V.steps, () => {

					If( T.lessThan( 0.02 ).or( tt.greaterThan( t1 ) ), () => {

						Break();

					} );
					const p = ro.add( rd.mul( tt ) );
					const s = densityAt( p );
					// fine steps near the camera, coarser with distance
					const step = max( tt.mul( V.stepGrowth ), V.minStep ).toVar();
					// above the billows: skip down toward them (the band's top is V.top above the swell)
					const gap = s.h.sub( V.top + 0.3 );
					If( gap.greaterThan( 0 ), () => {

						step.assign( max( step, gap.mul( 0.8 ).div( max( rd.y.negate(), 0.12 ) ) ) );

					} );
					If( s.d.greaterThan( 0.003 ), () => {

						// light: optical depth toward the sun
						const od = float( 0 ).toVar();
						let prev = 0;
						for ( const dist of V.lightSteps ) {

							od.addAssign( densityAt( p.add( L.mul( dist ) ) ).d.mul( dist - prev ) );
							prev = dist;

						}
						// self-shadowing: how much sunlight gets through the gas toward the sun (with a softer
						// multiple-scattering share, so shadowed folds aren't black)
						const k = V.density * V.lightDensity;
						const sun = exp( od.mul( - k ) ).mul( 0.7 ).add( exp( od.mul( - k * 0.25 ) ).mul( 0.3 ) );
						// the billow's surface normal from the density gradient: shaded like the sea mesh
						// (cloudColor), so near volume and far mesh match
						const e = V.normalStep;
						const gx = densityAt( p.add( vec3( e, 0, 0 ) ) ).d.sub( s.d );
						const gy = densityAt( p.add( vec3( 0, e, 0 ) ) ).d.sub( s.d );
						const gz = densityAt( p.add( vec3( 0, 0, e ) ) ).d.sub( s.d );
						const grad = vec3( gx, gy, gz );
						const N = length( grad ).greaterThan( 1e-4 ).select( normalize( grad.negate() ), vec3( 0, 1, 0 ) );
						const tint = smoothstep( 0.3, 0.7, texture3D( noise, p.div( 420 ) ).level( 0 ).r ); // broad colour drift
						const crest = smoothstep( - 0.3, 0.75, s.surf.div( sea.uMaxAmp ) );
						const col = cloudColor( N, L, rd.negate(), crest, tint, sun.mul( 0.7 ).add( 0.3 ), c )
							.add( c( 'sun' ).mul( sun.mul( phase.sub( 1 ).max( 0 ) ).mul( V.sun ) ) ); // extra glow looking into the light
						// the region's tint and the distance haze, as on the sea mesh
						const fogged = mix( sea.regionTint( col ), sea.uFogColor, exp( sea.uFogDensity.mul( tt ).pow( 2 ).negate() ).oneMinus() );
						const ext = s.d.mul( V.density ).mul( step ).mul( smoothstep( V.range, V.range * 0.65, tt ) );
						const a = exp( ext.negate() );
						S.addAssign( fogged.mul( T ).mul( a.oneMinus() ) );
						T.mulAssign( a );

					} );
					tt.addAssign( step );

				} );

			} );
			if ( DEBUG ) {

				const dp = ro.add( rd.mul( 30 ) );
				const n = texture3D( noise, dp.div( V.baseScale ) ).level( 0 );
				return vec4( n.r, n.g, densityAt( dp ).d, 0 );

			}
			return vec4( S, T );

		} );

		this.node = rtt( march(), null, null, { resolutionScale: V.resolution } );

	}

	// composite over the scene colour (vec4 node): what's behind, dimmed by the gas, plus its glow
	composite( sceneColor ) {

		const v = this.node.sample( screenUV );
		return vec4( sceneColor.rgb.mul( v.a ).add( v.rgb ), 1 );

	}

	update( surfer, camera ) {

		this.uFrame.value = ( this.uFrame.value + 1 ) % 64;
		// with no board (on foot) the tunnel collapses onto the camera
		if ( surfer ) this.uBoard.value.copy( surfer.position );
		else this.uBoard.value.copy( camera.position );

	}

}
