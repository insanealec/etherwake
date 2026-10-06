import * as THREE from 'three/webgpu';
import {
	Fn, uniform, float, vec2, vec3, vec4, Loop, If, Break, screenUV, screenCoordinate, getViewPosition, texture3D, smoothstep, mix, max,
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
// faded out by VOLUME.range, where the sea mesh takes over. ?noVolume turns it off. Debug views:
// ?volDebug (raw noise r/g, density 30 m out in b), =n (first-hit normals), =t (hit distance / 60 m),
// =e (ray start, end and where the march stopped, / 220 m), =d (scene depth, view z and distance / 220 m).
export const VOLUME = {
	range: 220, // metres of raymarched sea; the mesh is drawn beyond (it fades out from 0.65 of this)
	steps: 96, // samples per ray (at most): enough for the growing steps to reach the range
	minStep: 0.25, // metres; steps grow with distance (stepGrowth of the distance travelled)
	stepGrowth: 0.045,
	maxSlope: 0.7, // steepest rise of the cloud top, for skipping empty space safely
	lightSteps: [ 0.4, 1.3, 3.0 ], // distances toward the sun of the shadow samples (m)
	lightDensity: 0.3, // extinction scale for sunlight (lower: light reaches deeper into the billows)
	sun: 0.5, // extra forward-scattered sunlight looking toward the sun
	normalStep: 0.4, // metres, for the density gradient
	top: 5.0, // the gas (lumps, fringe, loose puffs) stays within this far above the swell (m)
	cameraClear: 4.8, // the chase camera keeps this far above the swell, above the billows (App)
	baseScale: 12, // metres per tile of the fringe noise
	detailScale: 7, // metres per tile of the detail noise
	lumps: 1.8, // the mesh's lumps, taller in the volume (the mesh fakes their relief with its normals)
	relief: 2, // normal tilt exaggeration
	fringe: 1.6, // metres the 3D noise lifts or cuts the cloud top
	erode: 0.9, // metres of finer fraying
	edge: 0.35, // half-thickness of the cloud top's soft edge (m), 2.5x that far away
	detailNear: 25, detailFar: 90, // metres: full 3D fraying within detailNear, none beyond detailFar
	puffs: 0.6, // loose puffs' density (0: none)
	puffScale: 30, puffHeight: 3.5, // loose puffs above the tops: noise tile (m), how high they drift
	density: 4, // extinction per metre at full density (high: cloud tops with crisp silhouettes)
	drift: [ 0.9, 0.12, 0.25 ], // m/s, the billows' slow flow
	forward: 0.55, // forward scattering (silver lining) strength
	tunnel: 2.6, // radius of the clear view from the camera to the board (m)
	resolution: 1 // of the screen
};

const DEBUG = new URLSearchParams( location.search ).get( 'volDebug' ); // '' (noise), 'n' (normals), 't' (hit distance / 60 m)

export class Volume {

	// sea: Etherium; seaHeight: SeaHeight; depthNode: the scene pass's depth texture node; camera: the
	// game camera (inside this full-screen pass three's camera nodes mean the quad's camera, so the game
	// camera's matrices are bound explicitly; they're read at render time, jitter included)
	constructor( sea, seaHeight, depthNode, camera ) {

		const V = VOLUME;
		const cameraPosition = uniform( camera.position );
		const cameraWorldMatrix = uniform( camera.matrixWorld );
		const cameraProjectionMatrixInverse = uniform( camera.projectionMatrixInverse );
		this.uBoard = uniform( new THREE.Vector3( 0, - 1000, 0 ) );
		this.uFrame = uniform( 0 );
		const noise = cloudNoiseTexture( 64 );
		const t = sea.uTime;
		const L = sea.uSunDir;
		const uColors = {};
		const c = ( k ) => uColors[ k ] || ( uColors[ k ] = uniform( PALETTE[ k ] ) );

		// density at world point p (0..1), plus the swell height there (for the crest glow)
		const densityAt = ( p ) => {

			// the cloud top: the swell plus the sea mesh's own lumps (shared, so near and far match)
			const hs = seaHeight.sample( p.xz );
			const surf = hs.r;
			const h = p.y.sub( surf );
			const flow = vec3( ...V.drift ).mul( t );
			const base = texture3D( noise, p.sub( flow ).div( V.baseScale ) ).level( 0 ).r;
			const detail = texture3D( noise, p.sub( flow.mul( 1.6 ) ).div( V.detailScale ) ).level( 0 ).g;
			// 3D noise frays the top: overhangs and wisps the heightfield can't make
			// level of detail: the fine fraying fades with distance (far away it's finer than a pixel and
			// turns to blotches), and the edge softens, so the far volume matches the smooth mesh lumps
			const near = smoothstep( V.detailFar, V.detailNear, length( p.sub( cameraPosition ) ) );
			const top = surf.add( hs.g.mul( V.lumps ) ).add( base.sub( 0.55 ).mul( V.fringe ).mul( near ) );
			const above = p.y.sub( top ).add( detail.sub( 0.5 ).mul( V.erode ).mul( near ) );
			const edge = near.oneMinus().mul( V.edge * 1.5 ).add( V.edge );
			const body = smoothstep( edge, edge.negate(), above );
			// now and then a loose puff drifts above the tops
			const puff = smoothstep( 0.72, 0.86, texture3D( noise, p.sub( flow.mul( 0.7 ) ).div( V.puffScale ).add( 0.37 ) ).level( 0 ).r )
				.mul( smoothstep( V.puffHeight, 0.5, above ) ).mul( smoothstep( - 0.5, 0.8, above ) ).mul( V.puffs )
				.mul( smoothstep( 5, 18, length( p.sub( cameraPosition ) ) ) ); // not in the camera's face
			// the board parts the gas; a slim tunnel keeps the camera's view of the board clear
			const rider = this.uBoard.add( vec3( 0, 1.2, 0 ) ); // aim at the rider's chest
			const ab = rider.sub( cameraPosition );
			const along = p.sub( cameraPosition ).dot( ab ).div( ab.dot( ab ).max( 1e-3 ) ).clamp();
			const tunnel = length( p.sub( cameraPosition.add( ab.mul( along ) ) ) );
			const carve = smoothstep( 0.8, 2.0, length( p.sub( this.uBoard ) ) ).mul( smoothstep( V.tunnel * 0.4, V.tunnel, tunnel ) );
			return { d: max( body, puff ).mul( carve ), surf, h, occ: hs.b, above, edge, near };

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
			const yTop = sea.uMaxAmp.mul( 1.6 ).add( V.top + 2 ), yBot = sea.uMaxAmp.mul( - 1.6 ).sub( 6 );
			const inv = float( 1 ).div( rd.y.abs().max( 1e-4 ).mul( rd.y.greaterThanEqual( 0 ).select( float( 1 ), float( - 1 ) ) ) );
			const ta = yTop.sub( ro.y ).mul( inv ), tb = yBot.sub( ro.y ).mul( inv );
			const t0 = max( min( ta, tb ), 0 ), t1 = min( min( max( ta, tb ), tScene ), V.range );

			const ttEnd = float( - 1 ).toVar(); // debug: where the march stopped
			const S = vec3( 0 ).toVar(); // light scattered toward the camera
			const hitN = vec3( 0 ).toVar(); // debug: the normal where the ray first meets dense gas
			const hitT = float( - 1 ).toVar();
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
					// surface-aware steps: above the cloud top, step by the distance to it (it can't be reached
					// sooner, even where it rises ahead at V.maxSlope), so rays slow down as they arrive and
					// sample the soft edge finely: fixed steps landed on the top at step-sized intervals and
					// terraced it. Near the puffs' height the steps stay modest so puffs aren't skipped.
					const step = max( tt.mul( V.stepGrowth ), V.minStep ).toVar();
					const safe = s.above.sub( s.edge ).mul( 0.9 ).div( max( rd.y.negate(), 0 ).add( V.maxSlope ) );
					If( s.above.greaterThan( s.edge ), () => {

						const cap = s.above.lessThan( V.puffHeight + 1 ).select( max( step, 1.5 ), float( 1e4 ) );
						step.assign( min( max( safe, V.minStep ), cap ) );

					} ).Else( () => {

						step.assign( min( step, s.edge.mul( 0.5 ).max( V.minStep ) ) );

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
						const relief = s.near.mul( V.relief - 1 ).add( 1 ); // tilted harder up close (as the mesh's bumps are), true far away
						const grad = vec3( gx.mul( relief ), gy, gz.mul( relief ) );
						const N = length( grad ).greaterThan( 1e-4 ).select( normalize( grad.negate() ), vec3( 0, 1, 0 ) );
						If( hitT.lessThan( 0 ).and( s.d.greaterThan( 0.5 ) ), () => {

							hitN.assign( N );
							hitT.assign( tt );

						} );
						const tint = smoothstep( 0.3, 0.7, texture3D( noise, p.div( 420 ) ).level( 0 ).r ); // broad colour drift
						const crest = smoothstep( - 0.3, 0.75, s.surf.div( sea.uMaxAmp ) );
						const col = cloudColor( N, L, rd.negate(), crest, tint, sun.mul( 0.35 ).add( 0.65 ).mul( s.occ.mul( 0.25 ).add( 0.75 ) ), c )
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
				ttEnd.assign( tt );

			} );
			if ( DEBUG === 'd' ) return vec4( depth, viewPos.z.negate().div( 220 ), length( toScene ).div( 220 ), 0 );
			if ( DEBUG === 'e' ) return vec4( t0.div( 220 ), t1.div( 220 ), ttEnd.div( 220 ), 0 );
			if ( DEBUG === 'n' ) return vec4( hitN.mul( 0.5 ).add( 0.5 ), 0 );
			if ( DEBUG === 't' ) return vec4( vec3( hitT.div( 60 ) ), 0 );
			if ( DEBUG !== null ) {

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
