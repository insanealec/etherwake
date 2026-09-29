import * as THREE from 'three/webgpu';
import { Fn, vec3, mix, positionWorld, mx_fractal_noise_float } from 'three/tsl';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HARBOR } from './WorldLayout.js';

// Brasslight Harbor (working name), procedural first pass (milestone 4): a floating moonlet ringed by a
// boardwalk on pilings, lanterns, shacks, banners and a lighthouse with a sweeping beam. You dock and
// launch anywhere around the boardwalk's outer edge. The ring is a circle collider that stops the board.
export const DECK_Y = 2.0; // deck height above the calm harbour surface
const RING_IN = 42;
const RING_OUT = 54;
const BOARD_R = 0.7; // board collision radius

export class Port {

	constructor( scene ) {

		this.group = new THREE.Group();
		this.group.position.set( HARBOR.x, 0, HARBOR.z );
		scene.add( this.group );
		this.time = 0;

		const mats = this.materials();
		this.buildMoonlet( mats );
		this.buildDecks( mats );
		this.buildLanterns( mats );
		this.buildShacks( mats );
		this.buildLighthouse( mats );
		this.buildBanners( mats );

		// collider in world space
		this.circle = { x: HARBOR.x, z: HARBOR.z, r: RING_OUT };

		// the boardwalk as a platform for the walker (it doesn't move: local = world)
		this.platform = {
			deckY: DECK_Y + 0.5,
			yaw: 0,
			walkable: ( x, z ) => this.walkable( x, z ),
			toWorld: ( local, out ) => out.copy( local ),
			launchEdge: ( x, z ) => this.launchEdge( x, z )
		};

	}

	materials() {

		const wood = new THREE.MeshStandardNodeMaterial( { roughness: 0.85 } );
		// weathered wood: streaky grain noise
		wood.colorNode = Fn( () => {

			const grain = mx_fractal_noise_float( positionWorld.mul( vec3( 0.6, 2.0, 0.6 ) ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			return mix( vec3( 0.16, 0.08, 0.035 ), vec3( 0.32, 0.17, 0.08 ), grain );

		} )();

		const rock = new THREE.MeshStandardNodeMaterial( { roughness: 0.95 } );
		rock.colorNode = Fn( () => {

			const n = mx_fractal_noise_float( positionWorld.mul( 0.08 ), 5, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const streak = mx_fractal_noise_float( positionWorld.mul( vec3( 0.5, 0.05, 0.5 ) ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			return mix( vec3( 0.035, 0.025, 0.05 ), vec3( 0.2, 0.15, 0.22 ), n.mul( n ) ).mul( streak.mul( 0.6 ).add( 0.6 ) );

		} )();

		return {
			wood, rock,
			brass: new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } ),
			canvas: new THREE.MeshStandardNodeMaterial( { color: 0xd9c9a3, roughness: 0.9, side: THREE.DoubleSide } ),
			banner: new THREE.MeshStandardNodeMaterial( { color: 0x9a2238, roughness: 0.8, side: THREE.DoubleSide } ),
			roof: new THREE.MeshStandardNodeMaterial( { color: 0x5c2a2a, roughness: 0.7 } ),
			glow: new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 4.0, 2.0, 0.7 ) } ),
			window: new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 2.4, 1.1, 0.35 ) } )
		};

	}

	buildMoonlet( { rock } ) {

		// a lumpy, slightly squashed rock, mostly above the gas
		const geo = mergeVertices( new THREE.IcosahedronGeometry( 36, 5 ).deleteAttribute( 'normal' ).deleteAttribute( 'uv' ) ); // shared vertices: smooth normals
		const p = geo.attributes.position, v = new THREE.Vector3();
		for ( let i = 0; i < p.count; i ++ ) {

			v.fromBufferAttribute( p, i ).normalize();
			const lump = 1 + 0.12 * Math.sin( v.x * 5.1 + v.y * 2.3 ) * Math.cos( v.z * 4.7 - v.y * 1.9 ) + 0.06 * Math.sin( v.x * 13 + v.z * 11 );
			p.setXYZ( i, v.x * 36 * lump, v.y * 26 * lump, v.z * 36 * lump );

		}
		geo.computeVertexNormals();
		const moonlet = new THREE.Mesh( geo, rock );
		moonlet.position.y = 6;
		this.group.add( moonlet );

	}

	buildDecks( { wood } ) {

		// boardwalk ring: an extruded annulus
		const shape = new THREE.Shape().absarc( 0, 0, RING_OUT, 0, Math.PI * 2 );
		shape.holes.push( new THREE.Path().absarc( 0, 0, RING_IN, 0, Math.PI * 2, true ) );
		const ringGeo = new THREE.ExtrudeGeometry( shape, { depth: 0.5, bevelEnabled: false, curveSegments: 64 } );
		ringGeo.rotateX( Math.PI / 2 );
		const ring = new THREE.Mesh( ringGeo, wood );
		ring.position.y = DECK_Y;
		this.group.add( ring );

		// pilings under the outer edge (instanced)
		const count = 36;
		const piling = new THREE.InstancedMesh( new THREE.CylinderGeometry( 0.3, 0.35, 14, 8 ), wood, count );
		const m = new THREE.Matrix4();
		for ( let i = 0; i < count; i ++ ) {

			const a = i / count * Math.PI * 2;
			piling.setMatrixAt( i, m.makeTranslation( Math.cos( a ) * ( RING_OUT - 1 ), DECK_Y - 7, Math.sin( a ) * ( RING_OUT - 1 ) ) );

		}
		this.group.add( piling );

	}

	buildLanterns( { brass, glow } ) {

		// lantern posts around the outer edge, and a few warm point lights over the boardwalk
		const count = 24;
		const posts = new THREE.InstancedMesh( new THREE.CylinderGeometry( 0.06, 0.08, 3, 6 ), brass, count );
		const lamps = new THREE.InstancedMesh( new THREE.SphereGeometry( 0.22, 10, 8 ), glow, count );
		const m = new THREE.Matrix4();
		for ( let i = 0; i < count; i ++ ) {

			const a = ( i + 0.25 ) / count * Math.PI * 2, r = RING_OUT - 0.4;
			posts.setMatrixAt( i, m.makeTranslation( Math.cos( a ) * r, DECK_Y + 1.5, Math.sin( a ) * r ) );
			lamps.setMatrixAt( i, m.makeTranslation( Math.cos( a ) * r, DECK_Y + 3.1, Math.sin( a ) * r ) );

		}
		this.group.add( posts, lamps );
		for ( let i = 0; i < 4; i ++ ) {

			const a = ( i + 0.5 ) / 4 * Math.PI * 2;
			const light = new THREE.PointLight( 0xffa050, 60, 45, 1.6 );
			light.position.set( Math.cos( a ) * ( RING_OUT - 1 ), DECK_Y + 3.5, Math.sin( a ) * ( RING_OUT - 1 ) );
			this.group.add( light );

		}

	}

	buildShacks( { wood, roof, window } ) {

		// a handful of shacks on the boardwalk, doors facing out
		const angles = [ 0.45, 1.2, 2.05, 2.75, 3.6, 4.3, 5.05, 5.8 ];
		this.shacks = []; // world-space footprints (for walking) and door spots (for NPCs)
		for ( const a of angles ) {

			const w = 5 + ( a * 7 % 3 ), h = 3.5 + ( a * 5 % 2 );
			const shack = new THREE.Group();
			const body = new THREE.Mesh( new THREE.BoxGeometry( w, h, 5 ), wood );
			body.position.y = h / 2;
			const top = new THREE.Mesh( new THREE.ConeGeometry( w * 0.78, 2.4, 4 ), roof );
			top.position.y = h + 1.2;
			top.rotation.y = Math.PI / 4;
			top.scale.z = 5 / w;
			const lit = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), window );
			lit.position.set( 0, h * 0.55, 2.51 );
			shack.add( body, top, lit );
			const r = ( RING_IN + RING_OUT ) / 2;
			shack.position.set( Math.cos( a ) * r, DECK_Y + 0.5, Math.sin( a ) * r );
			shack.rotation.y = Math.PI / 2 - a;
			this.group.add( shack );
			this.shacks.push( {
				x: HARBOR.x + Math.cos( a ) * r, z: HARBOR.z + Math.sin( a ) * r,
				ax: Math.cos( a ), az: Math.sin( a ), halfDepth: 2.5, halfWidth: w / 2, // box footprint, depth along the radius
				door: { x: HARBOR.x + Math.cos( a ) * ( r + 4.6 ), z: HARBOR.z + Math.sin( a ) * ( r + 4.6 ) }, // at the deck's outer edge
				mooring: { x: HARBOR.x + Math.cos( a ) * ( RING_OUT + 2.6 ), z: HARBOR.z + Math.sin( a ) * ( RING_OUT + 2.6 ) }, // on the water in front
				facing: Math.atan2( Math.cos( a ), Math.sin( a ) ) // yaw pointing outward
			} );

		}

	}

	buildLighthouse( { canvas, brass, glow } ) {

		const tower = new THREE.Mesh( new THREE.CylinderGeometry( 2.2, 3.2, 16, 16 ), canvas );
		tower.position.set( 0, 34, 0 );
		const cap = new THREE.Mesh( new THREE.ConeGeometry( 3, 3, 16 ), brass );
		cap.position.set( 0, 45.5, 0 );
		const lamp = new THREE.Mesh( new THREE.SphereGeometry( 1.4, 16, 12 ), glow );
		lamp.position.set( 0, 43, 0 );
		this.group.add( tower, cap, lamp );

		// sweeping beam: a long, faint additive cone from the lamp
		const beamGeo = new THREE.ConeGeometry( 14, 220, 24, 1, true );
		beamGeo.translate( 0, - 110, 0 );
		beamGeo.rotateZ( Math.PI / 2 );
		const beamMat = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 0.03, 0.022, 0.012 ), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide } );
		this.beam = new THREE.Mesh( beamGeo, beamMat );
		this.beam.position.set( 0, 43, 0 );
		this.group.add( this.beam );

		const light = new THREE.PointLight( 0xffc070, 120, 90, 1.6 );
		light.position.set( 0, 43, 0 );
		this.group.add( light );

	}

	buildBanners( { brass, banner } ) {

		this.banners = [];
		for ( let i = 0; i < 6; i ++ ) {

			const a = ( i + 0.5 ) / 6 * Math.PI * 2;
			const r = RING_OUT - 1;
			const pole = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.1, 9, 6 ), brass );
			pole.position.set( Math.cos( a ) * r, DECK_Y + 4.5, Math.sin( a ) * r );
			const cloth = new THREE.Mesh( new THREE.PlaneGeometry( 2.6, 1.3 ), banner );
			cloth.geometry.translate( 1.3, 0, 0 );
			cloth.position.set( pole.position.x, DECK_Y + 8, pole.position.z );
			this.group.add( pole, cloth );
			this.banners.push( cloth );

		}

	}

	// solid meshes the walk camera shouldn't pass through (not the beam or the glow bits)
	get cameraObstacles() {

		return this.group.children.filter( ( o ) => o !== this.beam && ! o.isLight && ! o.isInstancedMesh );

	}

	update( dt, windAngle ) {

		this.time += dt;
		this.beam.rotation.y = this.time * 0.5;
		this.banners.forEach( ( b, i ) => {

			b.rotation.y = - windAngle * Math.PI / 180 + Math.sin( this.time * 3 + i ) * 0.15;

		} );

	}

	// Docking from the board: the deck spot next to a board at (x, z) near the boardwalk, or null.
	dockPoint( x, z ) {

		const lx = x - HARBOR.x, lz = z - HARBOR.z, r = Math.hypot( lx, lz );
		if ( r < RING_OUT - 1 || r > RING_OUT + 6 ) return null;
		const spot = { x: HARBOR.x + lx / r * ( RING_OUT - 1.2 ), z: HARBOR.z + lz / r * ( RING_OUT - 1.2 ) };
		spot.platform = this.platform;
		return this.walkable( spot.x, spot.z ) ? spot : null;

	}

	// Launching on foot: at the boardwalk's outer edge, the sea spot just past it and the heading out,
	// else null. The inner edge (the moonlet side) doesn't count.
	launchEdge( x, z ) {

		if ( ! this.walkable( x, z ) ) return null;
		const lx = x - HARBOR.x, lz = z - HARBOR.z, r = Math.hypot( lx, lz );
		if ( r < RING_OUT - 2.2 ) return null;
		return { x: HARBOR.x + lx / r * ( RING_OUT + 3.5 ), z: HARBOR.z + lz / r * ( RING_OUT + 3.5 ), yaw: Math.atan2( lx, lz ) };

	}

	// Can someone stand here? On the boardwalk ring, not inside a shack.
	walkable( x, z ) {

		const r = Math.hypot( x - HARBOR.x, z - HARBOR.z );
		if ( r < RING_IN + 0.6 || r > RING_OUT - 0.4 ) return false;
		for ( const s of this.shacks ) {

			const dx = x - s.x, dz = z - s.z;
			const depth = dx * s.ax + dz * s.az, width = - dx * s.az + dz * s.ax;
			if ( Math.abs( depth ) < s.halfDepth + 0.3 && Math.abs( width ) < s.halfWidth + 0.3 ) return false;

		}
		return true;

	}

	// Push the board out of the boardwalk ring, sliding along it. Skipped while the board is well above
	// deck height, so a big jump can clear the edge.
	collide( surfer ) {

		const p = surfer.position, v = surfer.velocity;
		if ( p.y > DECK_Y + 1.5 ) return;
		const push = ( nx, nz, depth ) => {

			p.x += nx * depth;
			p.z += nz * depth;
			const into = v.x * nx + v.z * nz;
			if ( into < 0 ) {

				v.x -= nx * into * 1.3; // a little bounce
				v.z -= nz * into * 1.3;

			}

		};

		const c = this.circle;
		const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot( dx, dz );
		if ( d < c.r + BOARD_R && d > 1e-3 ) push( dx / d, dz / d, c.r + BOARD_R - d );

	}

}
