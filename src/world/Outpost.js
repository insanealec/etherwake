import * as THREE from 'three/webgpu';
import { Fn, vec3, mix, positionWorld, mx_fractal_noise_float } from 'three/tsl';
import { buildFigure } from '../player/Figure.js';

const RADIUS = 13; // the raft
const DECK = 1.8; // deck height above the mean surface under it
const MOORING = 7; // talk range from the mooring buoy (on the board)

// An outpost (milestone 8): a round floating raft riding the swell, with a lantern mast, awnings and a
// character (`npc`: the Ember Outpost's trader, Frostwater Station's ice pilot) who sells the
// shipwright's wares, so you can spend what you earn out here. Talk from the board at the glowing
// mooring buoy. The raft stops the board.
export class Outpost {

	// at: { x, z }; npc: character data; canvas / glow / light: the station's colours
	constructor( scene, sea, { at, npc, canvas = 0x8a2a1a, glow = [ 4.0, 1.6, 0.5 ], light = 0xff8040 } ) {

		this.at = at;
		this.npc = npc;

		this.sea = sea;
		this.time = 0;
		this.group = new THREE.Group();
		this.group.rotation.order = 'YXZ';
		this.group.position.set( at.x, 0, at.z );
		scene.add( this.group );

		const wood = new THREE.MeshStandardNodeMaterial( { roughness: 0.8 } );
		wood.colorNode = Fn( () => {

			const grain = mx_fractal_noise_float( positionWorld.mul( vec3( 0.6, 2.0, 0.6 ) ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
			return mix( vec3( 0.14, 0.06, 0.03 ), vec3( 0.3, 0.14, 0.06 ), grain );

		} )();
		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		const cloth = new THREE.MeshStandardNodeMaterial( { color: canvas, roughness: 0.9, side: THREE.DoubleSide } );
		const lampGlow = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( ...glow ), fog: false } );

		const g = this.group;
		const raft = new THREE.Mesh( new THREE.CylinderGeometry( RADIUS, RADIUS * 0.9, 1.4, 32 ), wood );
		raft.position.y = - 0.7;
		const rim = new THREE.Mesh( new THREE.TorusGeometry( RADIUS, 0.18, 8, 48 ), brass );
		rim.rotation.x = Math.PI / 2;
		const mast = new THREE.Mesh( new THREE.CylinderGeometry( 0.25, 0.35, 16, 10 ), wood );
		mast.position.y = 8;
		const lamp = new THREE.Mesh( new THREE.SphereGeometry( 0.9, 14, 10 ), lampGlow );
		lamp.position.y = 16.6;
		g.add( raft, rim, mast, lamp );

		// awnings: red canvas over two stalls
		for ( const a of [ 0.6, 2.8 ] ) {

			const stall = new THREE.Group();
			const awning = new THREE.Mesh( new THREE.PlaneGeometry( 5, 3.5 ), cloth );
			awning.rotation.x = - Math.PI / 2 + 0.3;
			awning.position.y = 3;
			const table = new THREE.Mesh( new THREE.BoxGeometry( 3.5, 1, 1.2 ), wood );
			table.position.y = 0.5;
			for ( const x of [ - 2.3, 2.3 ] ) {

				const pole = new THREE.Mesh( new THREE.CylinderGeometry( 0.06, 0.06, 3.2, 6 ), brass );
				pole.position.set( x, 1.6, 1.4 );
				stall.add( pole );

			}
			stall.add( awning, table );
			stall.position.set( Math.cos( a ) * 7, 0, Math.sin( a ) * 7 );
			stall.rotation.y = Math.PI / 2 - a;
			g.add( stall );

		}

		// the trader, at the rim facing the mooring
		const facing = 0.6;
		this.trader = buildFigure( { coat: 0x7a3a12, hat: 0x2a1a10 } );
		this.trader.position.set( Math.cos( facing ) * ( RADIUS - 1.5 ), 0, Math.sin( facing ) * ( RADIUS - 1.5 ) );
		this.trader.rotation.y = Math.PI / 2 - facing;
		g.add( this.trader );

		// the mooring buoy out front (world space, bobbing)
		this.buoy = new THREE.Group();
		const post = new THREE.Mesh( new THREE.CylinderGeometry( 0.07, 0.09, 1.8, 8 ).translate( 0, 0.9, 0 ), brass );
		const buoyLamp = new THREE.Mesh( new THREE.SphereGeometry( 0.22, 12, 8 ).translate( 0, 1.9, 0 ), lampGlow );
		this.buoy.add( post, buoyLamp );
		this.buoyAngle = facing;
		scene.add( this.buoy );

		const pl = new THREE.PointLight( light, 120, 60, 1.6 );
		pl.position.y = 14;
		g.add( pl );
		this.float( 1, true );

	}

	float( dt, snap = false ) {

		const g = this.group, at = ( x, z ) => this.sea.heightAt( g.position.x + x, g.position.z + z );
		const c = at( 0, 0 ), e = at( 9, 0 ), w = at( - 9, 0 ), n = at( 0, - 9 ), s = at( 0, 9 );
		const k = snap ? 1 : 1 - Math.exp( - 1.2 * dt );
		this.lift = ( this.lift ?? c ) + ( ( c + e + w + n + s ) / 5 - ( this.lift ?? c ) ) * k;
		g.position.y = this.lift + DECK;
		g.rotation.x += ( Math.atan2( s - n, 18 ) * 0.7 - g.rotation.x ) * k;
		g.rotation.z += ( Math.atan2( e - w, 18 ) * 0.7 - g.rotation.z ) * k;

	}

	update( dt ) {

		this.time += dt;
		this.float( dt );
		const r = RADIUS + 3.5, b = this.buoy.position;
		b.set( this.at.x + Math.cos( this.buoyAngle ) * r, 0, this.at.z + Math.sin( this.buoyAngle ) * r );
		b.y = this.sea.heightAt( b.x, b.z ) - 0.1;

	}

	// close enough to the mooring buoy to talk from the board?
	nearMooring( p ) {

		return Math.hypot( p.x - this.buoy.position.x, p.z - this.buoy.position.z ) < MOORING;

	}

	// keep the board off the raft (unless it's jumping clear over)
	collide( surfer ) {

		const p = surfer.position, v = surfer.velocity, g = this.group.position;
		if ( p.y > g.y + 1.5 ) return;
		const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot( dx, dz ), r = RADIUS + 0.7;
		if ( d >= r || d < 1e-3 ) return;
		const nx = dx / d, nz = dz / d;
		p.x += nx * ( r - d );
		p.z += nz * ( r - d );
		const into = v.x * nx + v.z * nz;
		if ( into < 0 ) {

			v.x -= nx * into * 1.3;
			v.z -= nz * into * 1.3;

		}

	}

}
