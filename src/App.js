import * as THREE from 'three/webgpu';
import { Starfield } from './sky/Starfield.js';
import { FlyCamera } from './core/FlyCamera.js';
import { Input } from './core/Input.js';

// Top-level app: owns the renderer, scene, camera and the frame loop.
// Systems are added here as milestones land (see docs/roadmap.md).
export class App {

	constructor( container ) {

		this.container = container;
		this.params = new URLSearchParams( location.search );

		this.renderer = new THREE.WebGPURenderer( { antialias: true } );
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;
		container.appendChild( this.renderer.domElement );

		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 20000 );
		this.camera.position.set( 0, 4, 18 );

		this.clock = new THREE.Timer();
		this.input = new Input( this.renderer.domElement );
		this.fly = new FlyCamera( this.camera, this.input );

		window.addEventListener( 'resize', () => this.onResize() );

	}

	async start() {

		await this.renderer.init();
		this.backend = this.renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
		console.info( `[etherwake] renderer backend: ${ this.backend }` );

		this.starfield = new Starfield( this.scene );
		this.buildPlaceholders();

		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );

	}

	// Temporary reference objects so camera motion reads against the sky.
	// Replaced by the etherium sea in milestone 1.
	buildPlaceholders() {

		const sun = new THREE.DirectionalLight( 0xffe2b0, 3.0 );
		sun.position.set( 40, 30, -20 );
		this.scene.add( sun );
		this.scene.add( new THREE.HemisphereLight( 0x6a5cff, 0x2a0f24, 0.6 ) );

		const brass = new THREE.MeshStandardNodeMaterial( { color: 0xb8863b, metalness: 0.9, roughness: 0.35 } );
		const rock = new THREE.MeshStandardNodeMaterial( { color: 0x4b3f5c, roughness: 0.9 } );

		const buoy = new THREE.Mesh( new THREE.TorusKnotGeometry( 2, 0.55, 160, 24 ), brass );
		this.scene.add( buoy );
		this.buoy = buoy;

		const geo = new THREE.IcosahedronGeometry( 1, 1 );
		for ( let i = 0; i < 40; i ++ ) {

			const m = new THREE.Mesh( geo, rock );
			const r = 25 + Math.random() * 60, a = Math.random() * Math.PI * 2;
			m.position.set( Math.cos( a ) * r, ( Math.random() - 0.5 ) * 30, Math.sin( a ) * r );
			m.scale.setScalar( 0.5 + Math.random() * 3 );
			m.rotation.set( Math.random() * 3, Math.random() * 3, 0 );
			this.scene.add( m );

		}

	}

	frame( time ) {

		this.clock.update( time );
		const dt = Math.min( this.clock.getDelta(), 0.1 );

		this.fly.update( dt );
		this.buoy.rotation.y += dt * 0.3;
		this.buoy.rotation.x += dt * 0.1;

		this.renderer.render( this.scene, this.camera );

	}

	onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
