import * as THREE from 'three/webgpu';
import { Starfield } from './sky/Starfield.js';
import { Etherium } from './sea/Etherium.js';
import { TweakPanel } from './ui/TweakPanel.js';
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
		this.camera.position.set( 0, 18, 40 );

		this.clock = new THREE.Timer();
		this.input = new Input( this.renderer.domElement );
		this.fly = new FlyCamera( this.camera, this.input );

		window.addEventListener( 'resize', () => this.onResize() );

	}

	async start() {

		await this.renderer.init();
		this.backend = this.renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
		console.info( `[etherwake] renderer backend: ${ this.backend }` );

		this.sea = new Etherium( this.scene );
		this.starfield = new Starfield( this.scene, { horizon: this.sea.uFogColor, underwater: this.sea.uUnderwater } );
		this.tweaks = new TweakPanel( this );

		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );

	}

	frame( time ) {

		this.clock.update( time );
		const dt = Math.min( this.clock.getDelta(), 0.1 );

		this.fly.update( dt );
		this.sea.update( this.clock.getElapsed(), this.camera );

		this.renderer.render( this.scene, this.camera );

	}

	onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
