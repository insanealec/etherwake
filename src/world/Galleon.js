import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec3, float, length, mix, smoothstep, abs, sin, fract, uv, time, texture, normalMap, positionWorld, positionLocal, cameraPosition, mx_fractal_noise_float } from 'three/tsl';
import { GALLEON, HARBOR } from './WorldLayout.js';
import { RING_OUT } from './Port.js';
import { sailPower } from './Wind.js';
import { buildFigure } from '../player/Figure.js';
import { boardRatio } from '../game/Gear.js';
import { ASSETS, applyWood, lantern } from './Assets.js';

// The solar galleon (milestone 7), procedural first pass in a Treasure Planet-like spirit (our own
// design): a wooden hull with a rising sheer and brass trim, a stern castle with lit windows, a
// bowsprit, two masts with glowing solar sails, fan-shaped solar wings off the sides, and lanterns.
// It rides the full swell at anchor (pitch and roll from sampling the sea) and stops the board.
export const SHIP = {
	length: 36,
	beam: 9,
	depth: 6,
	freeboard: 3.4, // deck height above the mean surface under the hull
	response: 1.6, // how fast it follows the swell (1/s): heavier = slower
	// sailing (at the helm)
	thrust: 3.0, // push at full sail, times the point-of-sail efficiency: ~30 m/s on a beam reach,
	// ~26 running; heavy: about 8 s from a standstill to 20 m/s
	drag: 0.02, // linear drag (1/s)
	dragQuad: 0.003, // quadratic drag (1/m)
	keel: 1.5, // how fast sideways drift is killed (1/s)
	turnRate: 0.35, // rudder turn rate at speed (rad/s)
	turnSpeed: 6, // below this speed the rudder has less bite
	slope: 0.25, // how much the swell's slope pushes the ship
	sailRate: 0.5, // how fast W/S let out and take in sail (fraction per second)
	solar: 0.6 // starlight in the solar sails: this share of full push on any heading, even into the
	// wind (~20 m/s there); the wind adds more on good points of sail (~30 m/s on a beam reach)
};

const HALF = SHIP.length / 2, W = SHIP.beam / 2;
const DECK = 0.4; // deck surface height in ship coordinates
const CASTLE_FRONT = - HALF + 9; // the stern castle spans from here back to the stern
const MASTS = [ 6, - 3 ]; // mast positions along the ship (z)
const RIG = [ [ MASTS[ 0 ], 20, 10, 8 ], [ MASTS[ 1 ], 24, 12, 10 ] ]; // per mast: z, height, sail width, sail height
const HELM_Z = CASTLE_FRONT + 1.5; // the wheel
export const HELM_SPOT = { x: 0, z: CASTLE_FRONT + 0.7 }; // where the helmsman stands (ship coordinates)
const smooth = ( a, b, x ) => {

	const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};
// hull shape along t (0 = bow, 1 = stern)
const halfWidth = ( t ) => W * Math.pow( smooth( 0, 0.4, t ), 0.55 ) * ( 1 - 0.22 * smooth( 0.75, 1, t ) ) + 0.05;
const keel = ( t ) => SHIP.depth * ( 0.55 + 0.45 * smooth( 0, 0.35, t ) );
const sheer = ( t ) => 1.6 * Math.pow( 1 - t, 4 ) + 1.2 * Math.pow( t, 6 ); // the deck line rises at the ends

function hullGeometry() {

	const N = 48, M = 18, pos = [], uvs = [], index = [];
	for ( let i = 0; i <= N; i ++ ) {

		const t = i / N, w = halfWidth( t ), d = keel( t ), s = sheer( t ), z = HALF - t * SHIP.length;
		for ( let j = 0; j <= M; j ++ ) {

			const f = j / M * Math.PI; // starboard rail -> keel -> port rail
			const down = Math.pow( Math.sin( f ), 0.7 );
			pos.push( Math.cos( f ) * w * ( 1 - 0.12 * down ), s + 1.3 - d * down, z ); // rail 0.9 m above the deck
			uvs.push( t, 1 - down );

		}

	}
	for ( let i = 0; i < N; i ++ ) {

		for ( let j = 0; j < M; j ++ ) {

			const a = i * ( M + 1 ) + j, b = a + M + 1;
			index.push( a, a + 1, b, a + 1, b + 1, b );

		}

	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	geo.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	geo.setIndex( index );
	geo.computeVertexNormals();
	return geo;

}

// a flat panel filling the hull's cross-section at the stern (t = 1), in the xy plane
function transomGeometry() {

	const M = 18, w = halfWidth( 1 ), d = keel( 1 ), s = sheer( 1 ), pts = [];
	for ( let j = 0; j <= M; j ++ ) {

		const f = j / M * Math.PI, down = Math.pow( Math.sin( f ), 0.7 );
		pts.push( new THREE.Vector2( Math.cos( f ) * w * ( 1 - 0.12 * down ), s + 1.3 - d * down ) );

	}
	const geo = new THREE.ShapeGeometry( new THREE.Shape( pts ) );
	// uv.y as on the hull (1 at the rail, 0 at the keel), so the planks, wale and copper line up
	const pos = geo.attributes.position, uv = geo.attributes.uv;
	for ( let i = 0; i < uv.count; i ++ ) uv.setXY( i, 1, 1 - ( s + 1.3 - pos.getY( i ) ) / d );
	return geo;

}

function deckGeometry() {

	const pts = [];
	for ( let i = 0; i <= 40; i ++ ) {

		const t = i / 40;
		pts.push( new THREE.Vector2( halfWidth( t ) * 0.94, - ( HALF - t * SHIP.length ) ) );

	}
	for ( let i = 40; i >= 0; i -- ) {

		const t = i / 40;
		pts.push( new THREE.Vector2( - halfWidth( t ) * 0.94, - ( HALF - t * SHIP.length ) ) );

	}
	const geo = new THREE.ShapeGeometry( new THREE.Shape( pts ) );
	geo.rotateX( - Math.PI / 2 ); // shape y -> -z
	return geo;

}

// A solar sail: a gently bellied rectangle, glowing gold with ribs, brighter toward the middle
function sailGeometry( w, h, belly ) {

	const geo = new THREE.PlaneGeometry( w, h, 12, 10 );
	const p = geo.attributes.position;
	for ( let i = 0; i < p.count; i ++ ) {

		const u = p.getX( i ) / w * 2, v = p.getY( i ) / h * 2;
		p.setZ( i, belly * ( 1 - u * u ) * ( 1 - 0.5 * v * v ) );

	}
	geo.computeVertexNormals();
	return geo;

}

export class Galleon {

	// pose: where she was left last time (saved), else her anchorage from WorldLayout
	constructor( scene, sea, pose = GALLEON ) {

		this.sea = sea;
		this.time = 0;
		this.group = new THREE.Group();
		this.group.rotation.order = 'YXZ';
		this.group.position.set( pose.x, 0, pose.z );
		this.group.rotation.y = pose.yaw;
		this.pitch = 0;
		this.roll = 0;
		this.lift = 0;
		this.velocity = new THREE.Vector3(); // horizontal, while sailing or coasting
		this.sail = 0; // how much sail is out, 0 (furled) .. 1 (full)
		this.wheel = 0; // smoothed rudder, for spinning the wheel
		this.sailState = {};
		scene.add( this.group );
		this.build();
		this.float( 1, true );

		// the deck as a platform for the walker: local coordinates move with the ship
		const g = this.group;
		this.platform = {
			deckY: DECK,
			get yaw() {

				return g.rotation.y;

			},
			walkable: ( lx, lz ) => this.walkable( lx, lz ),
			toWorld: ( local, out ) => out.copy( local ).applyMatrix4( g.matrixWorld ),
			launchEdge: ( lx, lz ) => this.launchEdge( lx, lz )
		};

		// the quartermaster, minding the ship by the stern castle
		this.crew = buildFigure( { coat: 0x24485a, hat: 0x3a2a1a } );
		this.crew.position.set( 1.8, DECK, CASTLE_FRONT + 1.5 );
		g.add( this.crew );

	}

	// ship-local deck spot -> is it walkable (between the rails, not in the castle or a mast)?
	walkable( lx, lz ) {

		const t = ( HALF - lz ) / SHIP.length;
		if ( t < 0.07 || t > 0.97 ) return false;
		if ( Math.abs( lx ) > halfWidth( t ) * 0.94 - 0.55 ) return false;
		if ( lz < CASTLE_FRONT && Math.abs( lx ) < 3.9 ) return false;
		for ( const mz of MASTS ) if ( Math.hypot( lx, lz - mz ) < 0.7 ) return false;
		if ( Math.hypot( lx, lz - HELM_Z ) < 0.55 ) return false; // the wheel's post
		return true;

	}

	// world ( x, z ) -> ship-local { x, z }
	toLocal( x, z ) {

		const g = this.group.position, y = this.group.rotation.y, c = Math.cos( y ), s = Math.sin( y );
		const wx = x - g.x, wz = z - g.z;
		return { x: wx * c - wz * s, z: wx * s + wz * c };

	}

	// Docking from the board alongside the hull: the deck spot just inside the nearer rail, or null.
	dockPoint( x, z ) {

		const l = this.toLocal( x, z );
		if ( Math.abs( l.z ) > HALF - 3 || Math.abs( l.x ) > W + 6 || Math.abs( l.x ) < W - 1.5 ) return null;
		const t = ( HALF - l.z ) / SHIP.length;
		const spot = { x: Math.sign( l.x ) * ( halfWidth( t ) * 0.94 - 0.9 ), z: l.z, platform: this.platform };
		return this.walkable( spot.x, spot.z ) ? spot : null;

	}

	// Launching from the deck: at either rail, the world sea spot just over the side and the heading out.
	launchEdge( lx, lz ) {

		const t = ( HALF - lz ) / SHIP.length;
		if ( Math.abs( lx ) < halfWidth( t ) * 0.94 - 1.7 ) return null;
		const side = Math.sign( lx ) || 1;
		this.group.updateMatrixWorld();
		const out = new THREE.Vector3( side * ( W + 3.5 ), 0, lz ).applyMatrix4( this.group.matrixWorld );
		const y = this.group.rotation.y; // local +x in the world is ( cos y, -sin y )
		return { x: out.x, z: out.z, yaw: Math.atan2( side * Math.cos( y ), - side * Math.sin( y ) ) };

	}

	// solid parts the walk camera shouldn't pass through
	get cameraObstacles() {

		return this.solid;

	}

	// the quartermaster's world position (for talking and facing)
	crewPosition( out = new THREE.Vector3() ) {

		return this.crew.getWorldPosition( out );

	}

	build() {

		const wood = new THREE.MeshStandardNodeMaterial( { roughness: 0.75, side: THREE.DoubleSide } );
		const P = ASSETS.textures.planks, hullUV = uv().mul( vec2( 12, 4 ) );
		if ( P ) {

			wood.normalNode = normalMap( texture( P.nor, hullUV ) );
			wood.roughnessNode = texture( P.arm, hullUV ).g;

		}
		// hull planks with a brass rail stripe along the top
		wood.colorNode = Fn( () => {

			const grain = mx_fractal_noise_float( positionWorld.mul( vec3( 0.4, 3.0, 0.4 ) ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			const planks = smoothstep( 0.0, 0.08, abs( fract( uv().y.mul( 9.0 ) ).sub( 0.5 ) ) );
			const base = mix( vec3( 0.13, 0.05, 0.03 ), vec3( 0.3, 0.12, 0.06 ), grain ).mul( planks.mul( 0.35 ).add( 0.65 ) ).toVar();
			// the CC0 plank texture, when loaded (Assets.js), run along the hull
			if ( P ) base.assign( texture( P.diff, hullUV ).rgb.mul( vec3( 0.85, 0.7, 0.6 ) ) );
			// copper sheathing gone to verdigris below the waterline, a brass wale stripe, the gold rail band
			const copper = mix( vec3( 0.05, 0.22, 0.2 ), vec3( 0.32, 0.16, 0.07 ), grain.mul( grain ) ).mul( planks.mul( 0.2 ).add( 0.8 ) );
			base.assign( mix( copper, base, smoothstep( 0.3, 0.34, uv().y ) ) );
			base.assign( mix( base, vec3( 0.7, 0.46, 0.18 ), smoothstep( 0.0, 0.01, uv().y.sub( 0.62 ).abs().oneMinus().sub( 0.985 ) ) ) );
			return mix( base, vec3( 0.75, 0.5, 0.2 ), smoothstep( 0.93, 0.96, uv().y ) );

		} )();
		const deckWood = new THREE.MeshStandardNodeMaterial( { roughness: 0.85 } );
		const deckTextured = applyWood( deckWood, 'deck', uv().yx.mul( 0.3 ) ); // planks along the ship
		if ( ! deckTextured ) deckWood.colorNode = Fn( () => {

			const grain = mx_fractal_noise_float( positionWorld.mul( vec3( 2.0, 0.5, 0.25 ) ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			return mix( vec3( 0.24, 0.14, 0.07 ), vec3( 0.42, 0.26, 0.13 ), grain );

		} )();
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		// lights and sails ignore the fog, so the ship glows through the haze from the harbour
		const glow = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 4.0, 2.2, 0.8 ), fog: false } );
		const windowGlow = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 2.4, 1.2, 0.4 ) } );
		// solar sails: saturated gold, glowing brightest in the middle, with brass ribs. Opaque, so they
		// write depth: the volumetric etherium stops at them instead of drawing the gas behind on top
		const sail = new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide, fog: false } );
		this.uSailGlow = uniform( 0 );
		sail.colorNode = Fn( () => {

			const u = uv();
			const ribs = smoothstep( 0.06, 0.0, abs( fract( u.x.mul( 6.0 ) ).sub( 0.5 ) ) );
			const core = sin( u.x.mul( Math.PI ) ).mul( sin( u.y.mul( Math.PI ) ) );
			const glow = vec3( 1.0, 0.3, 0.04 ).mul( core.mul( 1.6 ).add( 0.25 ) );
			return mix( glow, vec3( 0.55, 0.32, 0.1 ), ribs.mul( 0.8 ) ).mul( this.uSailGlow.mul( 0.75 ).add( 0.25 ) ); // brighter with more canvas out

		} )();

		const g = this.group;
		const hull = new THREE.Mesh( hullGeometry(), wood );
		g.add( hull );
		// the transom: closes the stern, following the hull's last cross-section
		const transom = new THREE.Mesh( transomGeometry(), wood );
		transom.position.z = - HALF;
		g.add( transom );
		const deck = new THREE.Mesh( deckGeometry(), deckWood );
		deck.position.y = DECK;
		g.add( deck );

		// stern castle with a row of lit windows across the back
		const castle = new THREE.Mesh( new THREE.BoxGeometry( 7.2, 2.8, 9 ), wood ); // flush with the transom
		castle.position.set( 0, 1.8, - HALF + 4.5 );
		g.add( castle );
		this.solid = [ hull, castle ];
		this.sailMeshes = [];
		this.wingPivots = [];

		// the helm: a ship's wheel on a post just forward of the stern castle
		const helm = new THREE.Group();
		helm.position.set( 0, DECK, HELM_Z );
		const post = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.1, 1.1, 8 ), brass );
		post.position.y = 0.55;
		this.wheelMesh = new THREE.Group();
		this.wheelMesh.position.y = 1.15;
		this.wheelMesh.add( new THREE.Mesh( new THREE.TorusGeometry( 0.45, 0.04, 6, 24 ), brass ) );
		for ( let i = 0; i < 4; i ++ ) {

			const spoke = new THREE.Mesh( new THREE.CylinderGeometry( 0.025, 0.025, 1.2, 5 ), brass );
			spoke.rotation.z = i * Math.PI / 4;
			this.wheelMesh.add( spoke );

		}
		helm.add( post, this.wheelMesh );
		g.add( helm );
		for ( let i = 0; i < 4; i ++ ) {

			const win = new THREE.Mesh( new THREE.PlaneGeometry( 0.9, 0.7 ), windowGlow );
			win.position.set( - 2.4 + i * 1.6, 2.0, - HALF - 0.02 );
			win.rotation.y = Math.PI;
			g.add( win );

		}

		// bowsprit
		const sprit = new THREE.Mesh( new THREE.CylinderGeometry( 0.12, 0.2, 9, 8 ), brass );
		sprit.rotation.x = Math.PI / 2 - 0.35;
		sprit.position.set( 0, 2.8, HALF + 2.5 );
		g.add( sprit );

		// masts and solar sails
		for ( const [ z, h, sw, sh ] of RIG ) {

			const mast = new THREE.Mesh( new THREE.CylinderGeometry( 0.22, 0.32, h, 10 ), wood );
			mast.position.set( 0, h / 2, z );
			g.add( mast );
			this.solid.push( mast );
			// hung from its yard (top edge), so scaling it vertically raises and lowers it
			const s = new THREE.Mesh( sailGeometry( sw, sh, 1.2 ).translate( 0, - sh / 2, 0 ), sail );
			s.position.set( 0, h * 0.55 + sh / 2, z + 0.4 );
			const yard = new THREE.Mesh( new THREE.CylinderGeometry( 0.1, 0.1, sw + 1, 8 ), wood );
			yard.rotation.z = Math.PI / 2;
			yard.position.set( 0, h * 0.55 + sh / 2, z + 0.3 );
			g.add( yard );
			this.sailMeshes.push( s );
			g.add( s );
			const top = new THREE.Mesh( new THREE.SphereGeometry( 0.45, 12, 8 ), glow );
			top.position.set( 0, h + 0.4, z );
			g.add( top );

		}

		// solar wings: fans off each side, tilted up
		const fan = new THREE.Shape();
		fan.moveTo( 0, 0 );
		fan.lineTo( 11, 3 );
		fan.quadraticCurveTo( 12.5, 0, 11, - 4 );
		fan.lineTo( 0, - 1.5 );
		fan.lineTo( 0, 0 );
		for ( const side of [ 1, - 1 ] ) {

			const wingGeo = new THREE.ShapeGeometry( fan, 12 );
			const wuv = wingGeo.attributes.uv; // normalise the shape's raw coordinates to 0..1
			for ( let i = 0; i < wuv.count; i ++ ) wuv.setXY( i, wuv.getX( i ) / 12.5, ( wuv.getY( i ) + 4 ) / 7 );
			const wing = new THREE.Mesh( wingGeo, sail );
			wing.rotation.set( - Math.PI / 2, 0, 0 );
			wing.scale.x = side;
			const pivot = new THREE.Group();
			pivot.position.set( side * W * 0.9, 1.2, - 1 );
			pivot.rotation.z = side * 0.35; // tilt up
			pivot.add( wing );
			this.wingPivots.push( pivot );
			g.add( pivot );

		}

		// stern and bow lanterns
		for ( const [ x, y, z ] of [ [ 3.2, 3.9, - HALF + 1.5 ], [ - 3.2, 3.9, - HALF + 1.5 ], [ 0, 2.8, HALF - 0.5 ] ] ) {

			// a brass hurricane lantern (CC0 model, Assets.js) with a glowing heart, or just the glow
			const model = lantern( 0.9 );
			const l = new THREE.Mesh( new THREE.SphereGeometry( model ? 0.14 : 0.35, 10, 8 ), glow );
			l.position.set( x, y, z );
			g.add( l );
			if ( model ) {

				model.position.set( x, y - 0.38, z );
				g.add( model );

			}

		}
		// a rose-gold beacon beam from the mainmast, fading upward and as you get close
		const beamMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false } );
		const near = smoothstep( 60, 300, length( positionWorld.xz.sub( cameraPosition.xz ) ) );
		beamMat.colorNode = vec3( 0.55, 0.16, 0.2 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( near.mul( 0.85 ).add( 0.15 ) );
		const beamGeo = new THREE.CylinderGeometry( 1.4, 1.4, 160, 12, 1, true );
		beamGeo.translate( 0, 80 + 24, 0 );
		const beam = new THREE.Mesh( beamGeo, beamMat );
		beam.position.z = - 3;
		g.add( beam );

		const light = new THREE.PointLight( 0xffb060, 80, 40, 1.6 );
		light.position.set( 0, 6, 0 );
		g.add( light );

		this.dress( { brass, glow, windowGlow, sail } );

	}

	// Hero details (graphics pass 2): topsails, rigging, cap rails, portholes, figurehead, stern gallery,
	// a cornice on the castle and a long pennant. All decoration: no collision changes.
	dress( { brass, glow, windowGlow, sail } ) {

		const g = this.group;
		const railY = ( t ) => sheer( t ) + 1.3;
		const tOf = ( z ) => ( HALF - z ) / SHIP.length;

		// topsails above the main sails (they reef with them)
		for ( const [ z, h, sw, sh ] of RIG ) {

			const tw = sw * 0.72, th = sh * 0.55, y = h - 0.8;
			const s = new THREE.Mesh( sailGeometry( tw, th, 0.8 ).translate( 0, - th / 2, 0 ), sail );
			s.position.set( 0, y, z + 0.35 );
			const yard = new THREE.Mesh( new THREE.CylinderGeometry( 0.08, 0.08, tw + 0.8, 8 ).rotateZ( Math.PI / 2 ), brass );
			yard.position.set( 0, y, z + 0.28 );
			g.add( s, yard );
			this.sailMeshes.push( s );

		}

		// rigging: shrouds from each masthead down to the rails, stays fore and aft
		const rope = [];
		const seg = ( a, b ) => rope.push( ...a, ...b );
		for ( const [ z, h ] of RIG ) {

			for ( const side of [ 1, - 1 ] ) for ( const dz of [ - 2.5, - 0.8, 0.9 ] ) {

				const t = tOf( z + dz );
				seg( [ 0, h - 1.5, z ], [ side * halfWidth( t ) * 0.97, railY( t ), z + dz ] );

			}

		}
		const [ fore, main ] = RIG;
		seg( [ 0, fore[ 1 ] - 1, fore[ 0 ] ], [ 0, 2.8 + 4.5 * Math.sin( 0.35 ), HALF + 2.5 + 4.5 * Math.cos( 0.35 ) ] ); // forestay to the bowsprit tip
		seg( [ 0, main[ 1 ] - 1, main[ 0 ] ], [ 0, fore[ 1 ] - 1, fore[ 0 ] ] ); // mainstay
		seg( [ 0, main[ 1 ] - 1, main[ 0 ] ], [ 0, 3.4, - HALF + 1 ] ); // backstay to the castle
		const ropeGeo = new THREE.BufferGeometry();
		ropeGeo.setAttribute( 'position', new THREE.Float32BufferAttribute( rope, 3 ) );
		g.add( new THREE.LineSegments( ropeGeo, new THREE.LineBasicNodeMaterial( { color: 0x1a120c } ) ) );

		// brass cap rails along both sides
		for ( const side of [ 1, - 1 ] ) {

			const pts = [];
			for ( let i = 1; i < 40; i ++ ) {

				const t = 0.02 + i / 40 * 0.96;
				pts.push( new THREE.Vector3( side * halfWidth( t ), railY( t ) + 0.05, HALF - t * SHIP.length ) );

			}
			g.add( new THREE.Mesh( new THREE.TubeGeometry( new THREE.CatmullRomCurve3( pts ), 120, 0.07, 6 ), brass ) );
			( this.grindRails ||= [] ).push( pts ); // grindable (game/Grinds.js)

		}

		// portholes: brass rings with warm glass along both sides
		const ring = new THREE.TorusGeometry( 0.32, 0.06, 6, 16 ).rotateY( Math.PI / 2 );
		const pane = new THREE.CircleGeometry( 0.28, 14 ).rotateY( Math.PI / 2 );
		for ( let z = HALF - 9; z > CASTLE_FRONT + 1; z -= 2.6 ) {

			const t = tOf( z ), w = halfWidth( t ) * 0.94, y = railY( t ) - 1.3 - keel( t ) * 0.1;
			for ( const side of [ 1, - 1 ] ) {

				const r = new THREE.Mesh( ring, brass );
				r.position.set( side * ( w + 0.03 ), y, z );
				const p = new THREE.Mesh( pane, windowGlow );
				p.position.set( side * ( w + 0.05 ), y, z );
				p.rotation.y = side > 0 ? 0 : Math.PI;
				g.add( r, p );

			}

		}

		// figurehead: a brass star with a glowing heart, riding the stem
		const star = new THREE.Group();
		star.position.set( 0, railY( 0 ) + 0.1, HALF + 0.4 );
		const points = new THREE.Mesh( new THREE.OctahedronGeometry( 0.9 ).scale( 1, 1, 0.35 ), brass );
		const points2 = points.clone();
		points2.rotation.z = Math.PI / 4;
		points2.scale.setScalar( 0.75 );
		const heart = new THREE.Mesh( new THREE.SphereGeometry( 0.28, 12, 8 ), glow );
		heart.position.z = 0.05;
		star.add( points, points2, heart );
		g.add( star );

		// stern gallery (a balcony under the windows) and a cornice round the castle roof
		const rail = new THREE.Mesh( new THREE.CylinderGeometry( 0.06, 0.06, 7.4, 8 ).rotateZ( Math.PI / 2 ), brass );
		rail.position.set( 0, 2.4, - HALF - 0.85 );
		const floor = new THREE.Mesh( new THREE.BoxGeometry( 7.4, 0.12, 0.9 ), brass );
		floor.position.set( 0, 1.55, - HALF - 0.45 );
		g.add( rail, floor );
		for ( let i = 0; i <= 8; i ++ ) {

			const post = new THREE.Mesh( new THREE.CylinderGeometry( 0.04, 0.04, 0.8, 6 ), brass );
			post.position.set( - 3.6 + i * 0.9, 2.0, - HALF - 0.85 );
			g.add( post );

		}
		const cornice = new THREE.Mesh( new THREE.BoxGeometry( 7.7, 0.22, 9.5 ), brass );
		cornice.position.set( 0, 3.25, - HALF + 4.5 );
		g.add( cornice );

		// a long pennant streaming from the mainmast head
		const penGeo = new THREE.PlaneGeometry( 9, 1, 24, 1 ).translate( 4.5, 0, 0 );
		const pp = penGeo.attributes.position;
		for ( let i = 0; i < pp.count; i ++ ) pp.setY( i, pp.getY( i ) * ( 1 - pp.getX( i ) / 9.5 ) ); // taper
		penGeo.rotateY( Math.PI / 2 ); // streams aft (-z)
		const penMat = new THREE.MeshStandardNodeMaterial( { color: 0xc23048, emissive: 0x400a14, roughness: 0.8, side: THREE.DoubleSide } );
		const along = positionLocal.z.negate().div( 9 );
		penMat.positionNode = positionLocal.add( vec3( sin( time.mul( 5 ).add( along.mul( 8 ) ) ).mul( along ).mul( 0.6 ), sin( time.mul( 3.3 ).add( along.mul( 5 ) ) ).mul( along ).mul( 0.3 ), 0 ) );
		const pennant = new THREE.Mesh( penGeo, penMat );
		pennant.position.set( 0, main[ 1 ] + 0.2, main[ 0 ] );
		g.add( pennant );

	}

	// ride the swell: sample the sea at bow, stern and both sides for height, pitch and roll
	float( dt, snap = false ) {

		const g = this.group, yaw = g.rotation.y;
		const fx = Math.sin( yaw ), fz = Math.cos( yaw ), rx = fz, rz = - fx;
		const at = ( a, s ) => this.sea.heightAt( g.position.x + fx * a + rx * s, g.position.z + fz * a + rz * s );
		const bow = at( HALF * 0.8, 0 ), stern = at( - HALF * 0.8, 0 ), left = at( 0, - W ), right = at( 0, W ); // right = local +x
		const mean = ( bow + stern + left + right ) / 4;
		const pitch = Math.atan2( bow - stern, SHIP.length * 0.8 ), roll = Math.atan2( right - left, SHIP.beam ); // +z rotation lifts local +x
		const k = snap ? 1 : 1 - Math.exp( - SHIP.response * dt );
		this.lift += ( mean - this.lift ) * k;
		this.pitch += ( pitch - this.pitch ) * k;
		this.roll += ( roll - this.roll ) * k;
		g.position.y = this.lift + SHIP.freeboard - DECK;
		g.rotation.x = - this.pitch;
		g.rotation.z = this.roll;

	}

	// helm: { steer: -1..1 (right positive), sail: -1..1 (more / less sail) } while someone's at the helm, else null
	update( dt, helm = null ) {

		this.time += dt;
		if ( helm ) this.sail = Math.max( 0, Math.min( 1, this.sail + ( helm.sail || 0 ) * SHIP.sailRate * dt ) );
		this.sailing( dt, helm ? helm.steer || 0 : 0 );

		// the sails show how much canvas is out: they drop from the yards, the wings unfold, the glow rises
		this.sailShown = ( this.sailShown ?? this.sail ) + ( this.sail - ( this.sailShown ?? this.sail ) ) * ( 1 - Math.exp( - 3 * dt ) );
		const k = this.sailShown;
		for ( const m of this.sailMeshes ) m.scale.y = 0.08 + 0.92 * k;
		for ( const p of this.wingPivots ) p.scale.x = 0.15 + 0.85 * k;
		this.uSailGlow.value = k;
		this.float( dt );
		this.group.updateMatrixWorld();

	}

	get speed() {

		return Math.hypot( this.velocity.x, this.velocity.z );

	}

	forward( target = new THREE.Vector3() ) {

		const y = this.group.rotation.y;
		return target.set( Math.sin( y ), 0, Math.cos( y ) );

	}

	get position() {

		return this.group.position;

	}

	// The solar wind in the sails, a keel against drift, a rudder that needs way on, and a little push
	// from the swell's slope; the ship can't sail into the harbour ring.
	sailing( dt, steer ) {

		const S = SHIP, g = this.group, v = this.velocity;
		const speed = this.speed;
		// the board's sail, hull and rail upgrades carry over (see SHIP_FROM_BOARD in game/Gear.js)
		const thrust = S.thrust * boardRatio( 'thrust' ), dragQuad = S.dragQuad * boardRatio( 'dragQuad' ), turnRate = S.turnRate * boardRatio( 'turnRate' );
		this.wheel += ( steer - this.wheel ) * ( 1 - Math.exp( - 4 * dt ) );
		this.wheelMesh.rotation.z = - this.wheel * 2.5;
		g.rotation.y -= this.wheel * turnRate * Math.min( 1, 0.15 + speed / S.turnSpeed ) * dt;

		const fx = Math.sin( g.rotation.y ), fz = Math.cos( g.rotation.y );
		const eff = sailPower( g.rotation.y, this.sailState ).efficiency;
		this.solarOnly = eff < S.solar;
		const push = thrust * Math.max( S.solar, eff ) * this.sail;
		const n = this.sea.normalAt( g.position.x, g.position.z );
		v.x += ( fx * push + n.x * 12 * S.slope ) * dt;
		v.z += ( fz * push + n.z * 12 * S.slope ) * dt;

		// keel: bleed sideways drift; drag on the rest
		const fwd = v.x * fx + v.z * fz;
		const keep = Math.exp( - S.keel * dt );
		const latX = ( v.x - fx * fwd ) * keep, latZ = ( v.z - fz * fwd ) * keep;
		const fwd2 = fwd * Math.max( 0, 1 - ( S.drag + dragQuad * Math.abs( fwd ) ) * dt );
		v.x = fx * fwd2 + latX;
		v.z = fz * fwd2 + latZ;
		g.position.x += v.x * dt;
		g.position.z += v.z * dt;

		// keep clear of the harbour ring
		const dx = g.position.x - HARBOR.x, dz = g.position.z - HARBOR.z, d = Math.hypot( dx, dz ), min = RING_OUT + HALF;
		if ( d < min && d > 1e-3 ) {

			const nx = dx / d, nz = dz / d;
			g.position.x += nx * ( min - d );
			g.position.z += nz * ( min - d );
			const into = v.x * nx + v.z * nz;
			if ( into < 0 ) {

				v.x -= nx * into;
				v.z -= nz * into;

			}

		}

	}

	// where she lies, for saving
	// move her to (x, z), bow toward yaw, stopped, settled on the swell (summoned with G)
	moveTo( x, z, yaw ) {

		this.group.position.x = x;
		this.group.position.z = z;
		this.group.rotation.y = yaw;
		this.velocity.set( 0, 0, 0 );
		this.float( 0, true );

	}

	get pose() {

		const p = this.group.position;
		return { x: + p.x.toFixed( 1 ), z: + p.z.toFixed( 1 ), yaw: + this.group.rotation.y.toFixed( 3 ) };

	}

	// deck height in world space (at the ship's centre)
	get deckY() {

		return this.group.position.y + DECK;

	}

	// keep the board out of the hull (an oriented box), unless it's jumping clear over the rail
	collide( surfer ) {

		const p = surfer.position, v = surfer.velocity, g = this.group.position;
		if ( p.y > this.deckY + 1.5 ) return;
		const fx = Math.sin( this.group.rotation.y ), fz = Math.cos( this.group.rotation.y );
		const lx = p.x - g.x, lz = p.z - g.z;
		const along = lx * fx + lz * fz, across = lx * fz - lz * fx;
		const pa = HALF + 0.7 - Math.abs( along ), pc = W + 0.7 - Math.abs( across );
		if ( pa <= 0 || pc <= 0 ) return;
		let nx, nz, depth;
		if ( pc < pa ) {

			const s = Math.sign( across ) || 1;
			nx = fz * s; nz = - fx * s; depth = pc;

		} else {

			const s = Math.sign( along ) || 1;
			nx = fx * s; nz = fz * s; depth = pa;

		}
		p.x += nx * depth;
		p.z += nz * depth;
		const into = v.x * nx + v.z * nz;
		if ( into < 0 ) {

			v.x -= nx * into * 1.3;
			v.z -= nz * into * 1.3;

		}

	}

}
