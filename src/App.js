import * as THREE from 'three/webgpu';
import { Starfield } from './sky/Starfield.js';
import { Etherium } from './sea/Etherium.js';
import { TweakPanel } from './ui/TweakPanel.js';
import { FlyCamera } from './core/FlyCamera.js';
import { ChaseCamera } from './core/ChaseCamera.js';
import { Surfer } from './player/Surfer.js';
import { Wake } from './player/Wake.js';
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
		this.time = 0; // game time: advances by the capped dt, so tab switches don't jump the sea
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
		this.buildLights();

		this.surfer = new Surfer( this.scene, this.sea );
		this.wake = new Wake( this.scene, this.sea );
		this.chase = new ChaseCamera( this.camera, this.sea );
		this.surfer.onLand = ( r ) => this.onLand( r );
		this.chase.snap( this.surfer );
		this.hud = document.getElementById( 'hud' );
		this.toastEl = document.getElementById( 'toast' );
		this.setMode( this.params.has( 'fly' ) ? 'fly' : 'surf' );

		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );

	}

	// Key light roughly matching the sea's sun glint, plus a violet/rose sky fill.
	// Placeholder until the sky milestone owns lighting.
	buildLights() {

		const sun = new THREE.DirectionalLight( 0xffd2a0, 2.5 );
		sun.position.copy( this.sea.uSunDir.value ).multiplyScalar( 100 );
		this.scene.add( sun );
		this.scene.add( new THREE.HemisphereLight( 0x8a6cff, 0xff6a50, 0.9 ) );

	}

	// 'surf' (chase camera, surfer controls) or 'fly' (free debug camera; the surfer coasts)
	setMode( mode ) {

		this.mode = mode;
		if ( mode === 'fly' ) this.fly.euler.setFromQuaternion( this.camera.quaternion );
		else this.chase.snap( this.surfer );
		this.fly.enabled = mode === 'fly';
		this.hudHint = mode === 'fly'
			? 'FLY · click to look · WASD · Space/C up/down · Shift fast · F surf · H tweaks'
			: 'A/D carve · W sail · S brake · Space jump · R reset · F fly · H tweaks';

	}

	frame( time ) {

		this.clock.update( time );
		const dt = Math.max( 0, Math.min( this.clock.getDelta(), 0.1 ) );
		const input = this.input;

		if ( input.wasPressed( 'KeyF' ) ) this.setMode( this.mode === 'fly' ? 'surf' : 'fly' );

		this.time += dt;
		this.sea.update( this.time, this.camera );

		const surf = this.mode === 'surf';
		const key = ( c ) => surf && input.down( c ) ? 1 : 0;
		if ( surf && input.wasPressed( 'KeyR' ) ) this.surfer.reset( this.surfer.position.x, this.surfer.position.z );
		this.surfer.update( dt, {
			steer: key( 'KeyD' ) - key( 'KeyA' ),
			throttle: key( 'KeyW' ) - key( 'KeyS' ),
			jump: surf && input.wasPressed( 'Space' )
		} );
		this.wake.update( dt, this.surfer );

		if ( surf ) this.chase.update( dt, this.surfer );
		else this.fly.update( dt );

		this.updateHud();
		input.endFrame();
		this.renderer.render( this.scene, this.camera );

	}

	onLand( r ) {

		this.chase.land( r.impact );
		if ( r.kind === 'wipeout' ) return this.toast( 'Wipeout!' );
		const parts = [];
		if ( r.spin >= 180 ) parts.push( String( r.spin ) );
		if ( r.revert ) parts.push( 'revert' );
		if ( r.air >= 1.8 ) parts.push( `${ r.air.toFixed( 1 ) }s air` );
		if ( r.kind === 'sketchy' ) parts.push( 'sketchy' );
		else if ( parts.length ) parts.push( 'clean' );
		if ( parts.length ) this.toast( parts.join( ' · ' ) );

	}

	toast( text ) {

		this.toastEl.textContent = text;
		this.toastEl.style.opacity = 1;
		clearTimeout( this.toastTimer );
		this.toastTimer = setTimeout( () => this.toastEl.style.opacity = 0, 1600 );

	}

	updateHud() {

		const s = this.surfer, sail = s.sailState;
		const power = sail.efficiency === undefined ? '' : `  ·  ${ sail.name } ${ Math.round( sail.efficiency * 100 ) }%`;
		const text = `${ this.hudHint }  ·  ${ s.speed.toFixed( 0 ) } m/s${ s.grounded ? '' : ' · air' }${ power }`;
		if ( text !== this.hudText ) this.hud.textContent = this.hudText = text;

	}

	onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
