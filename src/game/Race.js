import * as THREE from 'three/webgpu';
import { uv, vec3, smoothstep, float, length, positionWorld, cameraPosition } from 'three/tsl';
import { COURSES, RACE } from './Races.js';
import { HARBOR, REGIONS } from '../world/WorldLayout.js';

const DEG = Math.PI / 180;

const LIT = new THREE.Color( 3.0, 1.7, 0.45 ); // the next gate's glow (gold)

// A race in progress: brass ring gates standing on the swell; the next one glows gold with a beacon,
// the one after is faintly lit. Every gate has a glowing centre disc: cross through it for a burst of
// speed. The clock starts at the first gate.
// A gate counts when you cross its plane going forward inside the ring (missed? loop back round).
// update() returns 'start', 'gate' or 'finish'; `boosted` is set on the frame a boost fires.
export class Race {

	constructor( scene, sea ) {

		this.sea = sea;
		this.state = 'idle'; // 'idle' | 'running'
		this.brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		this.lit = new THREE.MeshBasicNodeMaterial( { color: LIT } );
		this.dim = new THREE.MeshBasicNodeMaterial( { color: LIT.clone().multiplyScalar( 0.25 ) } );
		// the boost sweet spot: a soft additive disc inside the ring
		this.discMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } );
		this.discMat.colorNode = vec3( 0.15, 1.1, 1.0 ).mul( smoothstep( float( 0.5 ), float( 0.1 ), length( uv().sub( 0.5 ) ) ) );
		this.discGeo = new THREE.CircleGeometry( RACE.boostRadius, 32 );

		this.ringGeo = new THREE.TorusGeometry( RACE.gateRadius, 0.35, 10, 48 );
		this.group = new THREE.Group();
		scene.add( this.group );

		this.beamMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } );
		const near = smoothstep( 20, 120, length( positionWorld.xz.sub( cameraPosition.xz ) ) );
		this.beamMat.colorNode = vec3( LIT.r, LIT.g, LIT.b ).mul( 0.2 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( near.mul( 0.8 ).add( 0.2 ) );
		const beamGeo = new THREE.CylinderGeometry( 0.8, 0.8, 80, 12, 1, true );
		beamGeo.translate( 0, 40, 0 );
		this.beacon = new THREE.Mesh( beamGeo, this.beamMat );
		this.beacon.visible = false;
		scene.add( this.beacon );

	}

	start( id ) {

		this.course = COURSES.find( ( c ) => c.id === id );
		this.group.clear();
		const C = this.course.center ? REGIONS[ this.course.center ] : HARBOR;
		const pts = this.course.gates.map( ( [ a, r ] ) => ( { x: C.x + Math.cos( a * DEG ) * r, z: C.z + Math.sin( a * DEG ) * r } ) );
		this.gates = pts.map( ( p, i ) => {

			// face along the course: from the previous gate to the next
			const from = pts[ Math.max( 0, i - 1 ) ], to = pts[ Math.min( pts.length - 1, i + 1 ) ];
			const mesh = new THREE.Group();
			const ring = new THREE.Mesh( this.ringGeo, this.brass );
			mesh.add( ring, new THREE.Mesh( this.discGeo, this.discMat ) );
			mesh.position.set( p.x, 0, p.z );
			mesh.rotation.y = Math.atan2( to.x - from.x, to.z - from.z );
			this.group.add( mesh );
			return { ...p, mesh, ring };

		} );
		this.next = 0;
		this.time = 0;
		this.started = false;
		this.state = 'running';
		this.restyle();

	}

	stop() {

		this.state = 'idle';
		this.group.clear();
		this.beacon.visible = false;

	}

	restyle() {

		this.gates.forEach( ( g, i ) => {

			g.mesh.visible = i >= this.next;
			g.ring.material = i === this.next ? this.lit : i === this.next + 1 ? this.dim : this.brass;

		} );
		const g = this.gates[ this.next ];
		this.beacon.visible = !! g;
		if ( g ) {

			this.beacon.position.set( g.x, 0, g.z );

		}

	}

	update( dt, surfer ) {

		this.boosted = false;
		if ( this.state !== 'running' ) return null;
		if ( this.started ) this.time += dt;

		// gates ride the swell
		for ( const g of this.gates ) g.mesh.position.y = this.sea.heightAt( g.x, g.z ) + RACE.lift;
		this.beacon.position.y = this.gates[ this.next ].mesh.position.y - RACE.lift;

		// a gate counts when you cross its plane going forward, inside the ring; how far from the centre
		// you cross decides the boost (a little slack at the rim)
		const g = this.gates[ this.next ], p = surfer.position;
		const nx = Math.sin( g.mesh.rotation.y ), nz = Math.cos( g.mesh.rotation.y );
		const rx = p.x - g.x, rz = p.z - g.z;
		const side = rx * nx + rz * nz;
		const crossed = g.side !== undefined && g.side < 0 && side >= 0;
		g.side = side;
		if ( ! crossed ) return null;
		const offset = Math.hypot( rx * nz - rz * nx, ( p.y + 0.8 ) - g.mesh.position.y );
		if ( offset > RACE.gateRadius + 1 ) return null;

		if ( offset < RACE.boostRadius ) {

			const s = Math.sin( surfer.yaw ), c = Math.cos( surfer.yaw );
			surfer.velocity.x += s * RACE.boostSpeed;
			surfer.velocity.z += c * RACE.boostSpeed;
			this.boosted = true;

		}

		this.next ++;
		if ( this.next >= this.gates.length ) {

			this.stop();
			return 'finish';

		}
		this.restyle();
		if ( ! this.started ) {

			this.started = true;
			return 'start';

		}
		return 'gate';

	}

	get target() {

		if ( this.state !== 'running' ) return null;
		const g = this.gates[ this.next ];
		return { label: `${ this.course.name } · gate ${ this.next + 1 }/${ this.gates.length }`, x: g.x, z: g.z };

	}

}
