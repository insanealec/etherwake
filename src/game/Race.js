import * as THREE from 'three/webgpu';
import { uv, vec3, smoothstep, float, length, positionWorld, cameraPosition } from 'three/tsl';
import { COURSES, RACE } from './Races.js';
import { HARBOR } from '../world/WorldLayout.js';

const DEG = Math.PI / 180;

// A race in progress: brass ring gates standing on the swell; the next one glows gold with a beacon,
// the one after is faintly lit. The clock starts at the first gate. update() returns 'start', 'gate',
// 'finish' on those events.
export class Race {

	constructor( scene, sea ) {

		this.sea = sea;
		this.state = 'idle'; // 'idle' | 'running'
		this.brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.85, roughness: 0.35 } );
		this.lit = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 3.0, 1.7, 0.45 ) } );
		this.dim = new THREE.MeshBasicNodeMaterial( { color: new THREE.Color( 0.8, 0.45, 0.15 ) } );

		this.ringGeo = new THREE.TorusGeometry( RACE.gateRadius, 0.35, 10, 48 );
		this.group = new THREE.Group();
		scene.add( this.group );

		const beamMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } );
		const near = smoothstep( 20, 120, length( positionWorld.xz.sub( cameraPosition.xz ) ) );
		beamMat.colorNode = vec3( 0.6, 0.38, 0.1 ).mul( smoothstep( float( 1 ), float( 0 ), uv().y ) ).mul( near.mul( 0.8 ).add( 0.2 ) );
		const beamGeo = new THREE.CylinderGeometry( 0.8, 0.8, 80, 12, 1, true );
		beamGeo.translate( 0, 40, 0 );
		this.beacon = new THREE.Mesh( beamGeo, beamMat );
		this.beacon.visible = false;
		scene.add( this.beacon );

	}

	start( id ) {

		this.course = COURSES.find( ( c ) => c.id === id );
		this.group.clear();
		const pts = this.course.gates.map( ( [ a, r ] ) => ( { x: HARBOR.x + Math.cos( a * DEG ) * r, z: HARBOR.z + Math.sin( a * DEG ) * r } ) );
		this.gates = pts.map( ( p, i ) => {

			// face along the course: from the previous gate to the next
			const from = pts[ Math.max( 0, i - 1 ) ], to = pts[ Math.min( pts.length - 1, i + 1 ) ];
			const mesh = new THREE.Mesh( this.ringGeo, this.brass );
			mesh.position.set( p.x, 0, p.z );
			mesh.rotation.y = Math.atan2( to.x - from.x, to.z - from.z );
			this.group.add( mesh );
			return { ...p, mesh };

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
			g.mesh.material = i === this.next ? this.lit : i === this.next + 1 ? this.dim : this.brass;

		} );
		const g = this.gates[ this.next ];
		this.beacon.visible = !! g;
		if ( g ) this.beacon.position.set( g.x, 0, g.z );

	}

	update( dt, surfer ) {

		if ( this.state !== 'running' ) return null;
		if ( this.started ) this.time += dt;

		// gates ride the swell
		for ( const g of this.gates ) g.mesh.position.y = this.sea.heightAt( g.x, g.z ) + RACE.gateLift;
		this.beacon.position.y = this.gates[ this.next ].mesh.position.y;

		const g = this.gates[ this.next ], p = surfer.position;
		const d = Math.hypot( p.x - g.x, p.z - g.z, ( p.y + 0.8 ) - g.mesh.position.y );
		if ( d > RACE.gateRadius + 1 ) return null;

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
