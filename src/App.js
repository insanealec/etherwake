import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { Starfield } from './sky/Starfield.js';
import { Etherium } from './sea/Etherium.js';
import { GasGiant } from './sky/GasGiant.js';
import { Moon } from './sky/Moon.js';
import { SunFlare } from './post/SunFlare.js';
import { Motes, MOTE_LAYERS } from './sea/Motes.js';
import { Shells } from './sea/Shells.js';
import { TweakPanel } from './ui/TweakPanel.js';
import { FlyCamera } from './core/FlyCamera.js';
import { ChaseCamera } from './core/ChaseCamera.js';
import { Surfer } from './player/Surfer.js';
import { Wake } from './player/Wake.js';
import { Port } from './world/Port.js';
import { Npcs } from './world/Npcs.js';
import { Walker } from './player/Walker.js';
import { WalkCamera } from './core/WalkCamera.js';
import { Dialogue } from './ui/Dialogue.js';
import { SPAWN } from './world/WorldLayout.js';
import { WIND } from './world/Wind.js';
import { Spray } from './player/Spray.js';
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
		this.starfield = new Starfield( this.scene, { horizon: this.sea.uFogColor, underwater: this.sea.uUnderwater, sun: this.sea.uSunDir } );
		this.giant = new GasGiant( this.scene, this.sea.uSunDir );
		this.moon = new Moon( this.scene, this.sea.uSunDir );
		if ( ! this.params.has( 'noShells' ) ) this.shells = new Shells( this.scene, this.sea );
		this.motes = this.params.has( 'noMotes' ) ? [] : Object.values( MOTE_LAYERS ).map( ( layer ) => new Motes( this.scene, this.sea, layer ) );
		this.tweaks = new TweakPanel( this );
		this.buildPipeline();
		this.buildLights();

		this.port = new Port( this.scene );
		this.surfer = new Surfer( this.scene, this.sea );
		this.surfer.reset( SPAWN.x, SPAWN.z, SPAWN.yaw );
		this.wake = new Wake( this.scene, this.sea );
		this.spray = new Spray( this.scene );
		this.chase = new ChaseCamera( this.camera, this.sea );
		this.surfer.onLand = ( r ) => this.onLand( r );
		this.chase.snap( this.surfer );
		this.walker = new Walker( this.scene, this.port );
		this.walkCam = new WalkCamera( this.camera, this.input, this.port.cameraObstacles );
		this.npcs = new Npcs( this.scene, this.port );
		this.dialogue = new Dialogue();
		this.hud = document.getElementById( 'hud' );
		this.toastEl = document.getElementById( 'toast' );
		this.promptEl = document.getElementById( 'prompt' );
		this.setMode( this.params.has( 'fly' ) ? 'fly' : 'surf' );

		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );

	}

	// Scene pass plus bloom (skip with ?noBloom). Tone mapping and sRGB happen in the pipeline output.
	buildPipeline() {

		this.pipeline = new THREE.RenderPipeline( this.renderer );
		const color = pass( this.scene, this.camera ).getTextureNode( 'output' );
		this.flare = new SunFlare( this.sea.uSunDir );
		let out = color.add( this.flare.node );
		if ( ! this.params.has( 'noBloom' ) ) {

			this.bloom = bloom( color, 0.55, 0.45, 0.85 );
			out = out.add( this.bloom );

		}
		this.pipeline.outputNode = out;

	}

	// Key light roughly matching the sea's sun glint, plus a violet/rose sky fill.
	// Placeholder until the sky milestone owns lighting.
	buildLights() {

		const sun = new THREE.DirectionalLight( 0xffd2a0, 2.5 );
		sun.position.copy( this.sea.uSunDir.value ).multiplyScalar( 100 );
		this.scene.add( sun );
		this.scene.add( new THREE.HemisphereLight( 0x8a6cff, 0xff6a50, 0.9 ) );

	}

	// 'surf' (chase camera, board controls), 'walk' (on foot on the dock, orbit camera) or
	// 'fly' (free debug camera; F returns to whichever mode you left)
	setMode( mode ) {

		if ( mode === 'fly' && this.mode !== 'fly' ) this.returnMode = this.mode || 'surf';
		this.mode = mode;
		this.onFoot = mode === 'walk' || ( mode === 'fly' && this.returnMode === 'walk' );
		this.walker.visible = this.onFoot;
		this.surfer.riderVisible = ! this.onFoot;
		this.fly.enabled = mode === 'fly';
		if ( mode === 'fly' ) this.fly.euler.setFromQuaternion( this.camera.quaternion );
		else if ( mode === 'walk' ) this.walkCam.snap( this.walker );
		else this.chase.snap( this.surfer );
		this.hudHint = {
			fly: 'FLY · click to look · WASD · Space/C up/down · Shift fast · F back · H tweaks',
			walk: 'WASD walk · Shift run · mouse or ←/→ camera · E interact · F fly · H tweaks',
			surf: 'A/D carve · W sail · S brake · Space jump · R reset · F fly · H tweaks'
		}[ mode ];

	}

	// step off the board onto a pier end; the board stays parked in the slip
	dock( slip ) {

		this.surfer.reset( slip.sea.x, slip.sea.z, slip.yaw );
		this.walker.place( slip.deck.x, slip.deck.z, slip.yaw + Math.PI );
		this.setMode( 'walk' );

	}

	launch( slip ) {

		this.surfer.reset( slip.sea.x, slip.sea.z, slip.yaw );
		this.setMode( 'surf' );

	}

	frame( time ) {

		this.clock.update( time );
		const dt = Math.max( 0, Math.min( this.clock.getDelta(), 0.1 ) );
		const input = this.input;

		if ( input.wasPressed( 'KeyF' ) ) this.setMode( this.mode === 'fly' ? this.returnMode : 'fly' );

		this.time += dt;
		this.sea.update( this.time, this.camera );

		const surf = this.mode === 'surf', walk = this.mode === 'walk';
		const key = ( c ) => input.down( c ) ? 1 : 0;

		// board: ridden, or parked in its slip while on foot
		if ( this.onFoot ) this.surfer.park( dt );
		else {

			if ( surf && input.wasPressed( 'KeyR' ) ) this.surfer.reset( this.surfer.position.x, this.surfer.position.z );
			this.surfer.update( dt, surf ? {
				steer: key( 'KeyD' ) - key( 'KeyA' ),
				throttle: key( 'KeyW' ) - key( 'KeyS' ),
				jump: input.wasPressed( 'Space' )
			} : {} );
			this.port.collide( this.surfer );

		}

		this.interact( input );
		if ( walk && ! this.dialogue.active ) {

			this.walker.update( dt, { forward: key( 'KeyW' ) - key( 'KeyS' ), right: key( 'KeyD' ) - key( 'KeyA' ), run: input.down( 'ShiftLeft' ) }, this.walkCam.yaw );

		}
		this.npcs.update( dt, this.onFoot ? this.walker.position : null );
		this.port.update( dt, WIND.angle );
		this.wake.update( dt, this.surfer );
		this.spray.update( dt, this.surfer );

		if ( surf ) this.chase.update( dt, this.surfer );
		else if ( walk ) this.walkCam.update( dt, this.walker );
		else this.fly.update( dt );

		this.giant.update( this.time, this.camera );
		this.moon.update( this.camera );
		this.flare.update( this.camera );
		for ( const m of this.motes ) m.update( this.camera, this.surfer );
		if ( this.shells ) this.shells.update();
		this.updateHud();
		input.endFrame();
		this.pipeline.render();

	}

	// E to dock, launch or talk (E / Space advance dialogue); shows the matching prompt
	interact( input ) {

		const e = input.wasPressed( 'KeyE' );
		let prompt = '';
		if ( this.dialogue.active ) {

			if ( e || input.wasPressed( 'Space' ) ) this.dialogue.next();

		} else if ( this.mode === 'surf' ) {

			const s = this.surfer;
			const slip = this.port.slips.find( ( k ) => Math.hypot( k.sea.x - s.position.x, k.sea.z - s.position.z ) < 16 );
			if ( slip && s.grounded && s.speed < 10 ) {

				prompt = 'E · step onto the dock';
				if ( e ) this.dock( slip );

			}

		} else if ( this.mode === 'walk' ) {

			const w = this.walker.position;
			const npc = this.npcs.nearest( w );
			const slip = this.port.slips.find( ( k ) => Math.hypot( k.deck.x - w.x, k.deck.z - w.z ) < 3 );
			if ( npc ) {

				prompt = `E · talk to the ${ npc.name.toLowerCase() }`;
				if ( e ) this.dialogue.open( npc.name, npc.lines );

			} else if ( slip ) {

				prompt = 'E · launch the board';
				if ( e ) this.launch( slip );

			}

		}
		if ( this.dialogue.active ) prompt = '';
		if ( prompt !== this.promptText ) {

			this.promptText = prompt;
			this.promptEl.textContent = prompt;
			this.promptEl.style.opacity = prompt ? 1 : 0;

		}

	}

	onLand( r ) {

		this.chase.land( r.impact );
		this.spray.burst( this.surfer, Math.min( 40, 6 + r.impact * 3 ) | 0 );
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
		const text = this.onFoot ? this.hudHint : `${ this.hudHint }  ·  ${ s.speed.toFixed( 0 ) } m/s${ s.grounded ? '' : ' · air' }${ power }`;
		if ( text !== this.hudText ) this.hud.textContent = this.hudText = text;

	}

	// Debug: GPU cost of the scene pass, rendered n times into an offscreen w x h target (no present,
	// so no vsync), timed until the GPU queue drains. Returns ms per render. __ew.benchmark()
	async benchmark( n = 30, w = 1920, h = 1080 ) {

		const rt = new THREE.RenderTarget( w, h, { type: THREE.HalfFloatType, samples: 4 } );
		const cam = this.camera.clone();
		cam.aspect = w / h;
		cam.updateProjectionMatrix();
		const device = this.renderer.backend.device;
		this.renderer.setRenderTarget( rt );
		this.renderer.render( this.scene, cam );
		await device.queue.onSubmittedWorkDone();
		const t0 = performance.now();
		for ( let i = 0; i < n; i ++ ) this.renderer.render( this.scene, cam );
		await device.queue.onSubmittedWorkDone();
		const ms = ( performance.now() - t0 ) / n;
		this.renderer.setRenderTarget( null );
		rt.dispose();
		return ms;

	}

	onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
