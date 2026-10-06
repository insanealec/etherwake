import * as THREE from 'three/webgpu';
import {
	Fn, uniform, attribute, float, vec2, vec3, sin, cos, abs, length, normalize, dot, max, pow, smoothstep, mix, fract, floor,
	positionLocal, positionWorld, cameraPosition, normalWorld, uv, mx_fractal_noise_float
} from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { starLayer } from '../sky/Starfield.js';
import { MIGRATION } from './WorldLayout.js';
import { setBowWave } from '../sea/Etherium.js';

// Star-whale leviathans (milestone 6). Inspired in spirit by the space whale of Beyond Good & Evil and
// the leviathans of Death Stranding (our own design): a long, heavy body with wing-like pectoral fins
// and flukes; dark hide with patches that are windows onto the cosmos (a starfield fixed to your view
// direction, so the whale looks cut out of space), glowing freckles, pulsing flank stripes, gold eyes
// and a faint cyan aura. They swim a migration loop with their backs breaking the gas, and breach.

const POD = [
	// length (m), metres behind the lead, metres to the side, phase
	{ length: 64, behind: 0, side: 0, phase: 0 },
	{ length: 52, behind: 70, side: 38, phase: 1.7 },
	{ length: 26, behind: 55, side: - 22, phase: 3.1 } // the calf
];
const BREACH = { every: [ 35, 70 ], duration: 9, height: 0.33 }; // height in body lengths

// body radius along the length (t: 0 = nose, 1 = tail), as a fraction of the length
const radius = ( t ) => {

	const s = ( a, b, x ) => {

		const k = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) );
		return k * k * ( 3 - 2 * k );

	};
	return 0.1 * Math.pow( s( 0, 0.09, t ), 0.3 ) * ( 1 - 0.84 * s( 0.28, 0.97, t ) ) + 0.003; // blunt head, long taper

};

// One unit-length whale (head toward +z at z = 0.5), with `along` (0 nose .. 1 tail) and `fin`
// (0 on the body .. 1 at a fin tip) attributes for the swim deformation and the skin.
function whaleGeometry() {

	const N = 80, M = 32;
	const pos = [], uvs = [], along = [], fin = [], index = [];
	for ( let i = 0; i <= N; i ++ ) {

		const t = i / N, r = radius( t );
		for ( let j = 0; j <= M; j ++ ) {

			const a = j / M * Math.PI * 2, c = Math.cos( a ), s = Math.sin( a );
			pos.push( c * r, s * r * ( s < 0 ? 0.72 : 0.9 ), 0.5 - t );
			uvs.push( j / M, t );
			along.push( t );
			fin.push( 0 );

		}

	}
	for ( let i = 0; i < N; i ++ ) {

		for ( let j = 0; j < M; j ++ ) {

			const a = i * ( M + 1 ) + j, b = a + M + 1;
			index.push( a, b, a + 1, a + 1, b, b + 1 );

		}

	}
	const body = new THREE.BufferGeometry();
	body.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	body.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	body.setAttribute( 'along', new THREE.Float32BufferAttribute( along, 1 ) );
	body.setAttribute( 'fin', new THREE.Float32BufferAttribute( fin, 1 ) );
	body.setIndex( index );
	body.computeVertexNormals();

	// flat parts from a 2D outline (x across, y along the body), laid horizontal at z = zAt
	const flat = ( pts, finSpan ) => {

		const g = new THREE.ShapeGeometry( new THREE.Shape( pts.map( ( [ x, y ] ) => new THREE.Vector2( x, y ) ) ) );
		g.rotateX( Math.PI / 2 ); // outline y -> +z
		const p = g.attributes.position, fn = [];
		for ( let i = 0; i < p.count; i ++ ) fn.push( finSpan ? Math.min( 1, Math.abs( p.getX( i ) ) / finSpan ) : 0 );
		g.setAttribute( 'along', new THREE.Float32BufferAttribute( new Float32Array( p.count ), 1 ) );
		g.setAttribute( 'fin', new THREE.Float32BufferAttribute( fn, 1 ) );
		return g;

	};
	// `along` from the final position, so a part moves with the stretch of body it's attached to
	const setAlong = ( g ) => {

		const p = g.attributes.position, al = g.attributes.along;
		for ( let i = 0; i < p.count; i ++ ) al.setX( i, 0.5 - p.getZ( i ) );
		return g;

	};

	// pectoral fins: long and swept back, drooping a little, attached a third of the way back
	const tFin = 0.3, rFin = radius( tFin );
	const wing = [ [ 0, 0.03 ], [ 0.2, - 0.02 ], [ 0.44, - 0.13 ], [ 0.43, - 0.18 ], [ 0.2, - 0.12 ], [ 0, - 0.09 ] ];
	const fins = [ 1, - 1 ].map( ( side ) => {

		const g = flat( wing.map( ( [ x, y ] ) => [ x * side, y ] ), 0.44 );
		g.rotateZ( - 0.12 * side ); // slight droop
		g.translate( side * rFin * 0.85, - rFin * 0.35, 0.5 - tFin );
		// fin weight: distance out from the body
		const p = g.attributes.position, fn = g.attributes.fin;
		for ( let i = 0; i < p.count; i ++ ) fn.setX( i, Math.min( 1, Math.max( 0, ( Math.abs( p.getX( i ) ) - rFin ) / 0.4 ) ) );
		return setAlong( g );

	} );

	// flukes: a wide notched tail, horizontal
	const fluke = flat( [ [ 0, 0.03 ], [ 0.22, - 0.06 ], [ 0.2, - 0.12 ], [ 0.05, - 0.08 ], [ 0, - 0.1 ], [ - 0.05, - 0.08 ], [ - 0.2, - 0.12 ], [ - 0.22, - 0.06 ] ], 0 );
	fluke.translate( 0, 0, - 0.47 );
	setAlong( fluke );

	const geo = mergeGeometries( [ body, ...fins, fluke ] );
	geo.computeBoundingSphere();
	return geo;

}

function whaleMaterial( time, phase ) {

	const mat = new THREE.MeshStandardNodeMaterial( { roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide } );
	const along = attribute( 'along', 'float' ), fin = attribute( 'fin', 'float' );
	const ph = time.mul( 1.2 ).add( phase );

	// swimming: a vertical wave travelling to the tail, growing toward it; slow fin beats
	mat.positionNode = Fn( () => {

		const p = positionLocal.toVar();
		p.y.addAssign( sin( along.mul( 6.0 ).sub( ph ) ).mul( along.mul( along ) ).mul( 0.05 ) );
		p.y.addAssign( fin.mul( fin ).mul( sin( ph.mul( 0.6 ).add( 1.0 ) ) ).mul( 0.035 ) );
		return p;

	} )();

	mat.colorNode = mix( vec3( 0.025, 0.03, 0.06 ), vec3( 0.07, 0.06, 0.12 ), fin );

	mat.emissiveNode = Fn( () => {

		const u = uv();
		const around = sin( u.x.mul( Math.PI * 2 ) ); // +1 on the back, -1 under the belly (body only)
		const onBody = fin.lessThan( 0.01 ).select( float( 1 ), float( 0 ) );

		// windows onto the cosmos: patches along the back and flanks
		const patch = mx_fractal_noise_float( vec3( u.x.mul( 5.0 ), u.y.mul( 14.0 ), phase ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
		const portal = smoothstep( 0.6, 0.66, patch ).mul( smoothstep( - 0.6, 0.2, around ).mul( onBody ).add( fin.mul( 0.8 ) ) );
		const dir = normalize( positionWorld.sub( cameraPosition ) );
		const neb = mx_fractal_noise_float( dir.mul( 3.0 ), 3, 2.0, 0.5 ).mul( 0.5 ).add( 0.5 );
		const cosmos = mix( vec3( 0.3, 0.06, 0.55 ), vec3( 0.03, 0.4, 0.6 ), neb ).mul( pow( neb.max( 0 ), 1.5 ).mul( 1.2 ).add( 0.35 ) )
			.add( starLayer( dir, 90, 0.2 ).mul( 3.0 ) ).add( starLayer( dir, 180, 0.3 ).mul( 2.0 ) ).add( starLayer( dir, 380, 0.45 ).mul( 1.2 ) );

		// glowing freckles on the hide
		const grid = u.mul( vec2( 70, 190 ) );
		const cell = floor( grid ), f = fract( grid ).sub( 0.5 );
		const h = fract( sin( dot( cell, vec2( 127.1, 311.7 ) ) ).mul( 43758.5453 ) );
		const freckle = smoothstep( 0.22, 0.05, length( f ) ).mul( h.greaterThan( 0.93 ).select( float( 1 ), float( 0 ) ) ).mul( onBody );

		// flank stripes just below the midline, with pulses running nose to tail
		const stripe = smoothstep( 0.07, 0.0, abs( around.add( 0.18 ) ) ).mul( onBody ).mul( smoothstep( 0.9, 0.7, along ) ).mul( smoothstep( 0.1, 0.18, along ) );
		const pulse = pow( sin( along.mul( 18.0 ).sub( time.mul( 2.5 ) ) ).mul( 0.5 ).add( 0.5 ).max( 0 ), 3 );

		// gold eyes on each side of the head
		const side = cos( u.x.mul( Math.PI * 2 ) ).abs();
		const eye = smoothstep( 0.03, 0.012, length( vec2( along.sub( 0.075 ), around.sub( 0.12 ) ) ) ).mul( smoothstep( 0.85, 0.95, side ) ).mul( onBody );

		// cyan aura at grazing angles, so they read through the fog
		const rim = pow( dot( normalWorld, dir.negate() ).clamp().oneMinus(), 3 );

		const skin = vec3( 0.5, 0.9, 1.0 ).mul( freckle.mul( 1.2 ) )
			.add( vec3( 0.2, 0.9, 1.0 ).mul( stripe ).mul( pulse.mul( 1.6 ).add( 0.3 ) ) )
			.add( vec3( 3.0, 1.8, 0.4 ).mul( eye ) );
		return mix( skin, cosmos, portal ).add( vec3( 0.1, 0.45, 0.6 ).mul( rim ).mul( 0.35 ) );

	} )();

	return mat;

}

export class Leviathans {

	constructor( scene, sea ) {

		this.sea = sea;
		const geo = whaleGeometry();
		this.theta = 0.6; // position of the pod around the loop
		this.time = 0;
		this.whales = POD.map( ( w ) => {

			const mesh = new THREE.Mesh( geo, whaleMaterial( sea.uTime, uniform( w.phase ) ) );
			mesh.scale.setScalar( w.length );
			mesh.rotation.order = 'YXZ';
			mesh.frustumCulled = false;
			scene.add( mesh );
			return { ...w, mesh, breachAt: this.nextBreach(), breachT: - 1 };

		} );

	}

	// Keep the board out of the whales' bodies: push it sideways off a capsule along each spine, but only
	// at body height (you can jump over a back).
	collide( surfer ) {

		const p = surfer.position, v = surfer.velocity;
		for ( const w of this.whales ) {

			const m = w.mesh.position, fx = Math.sin( w.mesh.rotation.y ), fz = Math.cos( w.mesh.rotation.y );
			const lx = p.x - m.x, lz = p.z - m.z;
			const along = Math.max( - 0.42, Math.min( 0.45, ( lx * fx + lz * fz ) / w.length ) );
			const r = radius( 0.5 - along ) * w.length + 0.7;
			if ( p.y > m.y + r * 0.8 || p.y < m.y - r * 1.5 ) continue;
			const cx = lx - fx * along * w.length, cz = lz - fz * along * w.length;
			const d = Math.hypot( cx, cz );
			if ( d >= r || d < 1e-3 ) continue;
			const nx = cx / d, nz = cz / d;
			p.x += nx * ( r - d );
			p.z += nz * ( r - d );
			const into = v.x * nx + v.z * nz;
			if ( into < 0 ) {

				v.x -= nx * into * 1.2;
				v.z -= nz * into * 1.2;

			}

		}

	}

	nextBreach() {

		const [ a, b ] = BREACH.every;
		return this.time + a + Math.random() * ( b - a );

	}

	// the loop's point, tangent and outward normal at angle th
	loop( th ) {

		const M = MIGRATION;
		const x = M.x + Math.cos( th ) * M.radiusX, z = M.z + Math.sin( th ) * M.radiusZ;
		let tx = - Math.sin( th ) * M.radiusX, tz = Math.cos( th ) * M.radiusZ;
		const l = Math.hypot( tx, tz );
		tx /= l; tz /= l;
		return { x, z, tx, tz, nx: tz, nz: - tx, speedScale: l };

	}

	update( dt ) {

		this.time += dt;
		const M = MIGRATION;
		this.theta += M.speed / this.loop( this.theta ).speedScale * dt;

		for ( const w of this.whales ) {

			// formation: behind the lead along the loop, off to one side
			const L = this.loop( this.theta - w.behind / M.radiusX );
			const x = L.x + L.nx * w.side, z = L.z + L.nz * w.side;

			// breaching: now and then a whale arcs up out of the gas and dives back in
			if ( w.breachT < 0 && this.time > w.breachAt ) w.breachT = 0;
			let lift = 0, pitch = 0;
			if ( w.breachT >= 0 ) {

				w.breachT += dt / BREACH.duration;
				const u = w.breachT, H = BREACH.height * w.length;
				lift = Math.sin( Math.PI * u ) * H;
				pitch = Math.atan2( Math.cos( Math.PI * u ) * Math.PI * H / BREACH.duration, M.speed );
				if ( u >= 1 ) {

					w.breachT = - 1;
					w.breachAt = this.nextBreach();

				}

			}

			// cruising: the back just breaks the surface, with a slow rise and fall
			const surface = this.sea.heightAt( x, z );
			const r = radius( 0.25 ) * w.length;
			const bob = Math.sin( this.time * 0.35 + w.phase ) * r * 0.25;
			w.mesh.position.set( x, surface - r * 0.55 + bob + lift, z );
			w.mesh.rotation.set( - pitch, Math.atan2( L.tx, L.tz ), Math.sin( this.time * 0.3 + w.phase ) * 0.05 );

			// the bow wave rides with the whale; it fades while the whale is up out of the gas
			const i = this.whales.indexOf( w );
			setBowWave( i, x, z, L.tx, L.tz, w.length, Math.max( 0, 1 - lift / ( r * 2 ) ) );

		}

	}

}
