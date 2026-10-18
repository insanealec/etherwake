import * as THREE from 'three/webgpu';
import { Fn, uniform, pass, mrt, output, velocity, rtt, vec2, vec4, float, length, mix, smoothstep, screenUV, screenSize } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { Starfield } from './sky/Starfield.js';
import { Etherium, bowHeightAt, flareHeightAt } from './sea/Etherium.js';
import { GasGiant } from './sky/GasGiant.js';
import { Moon } from './sky/Moon.js';
import { SunFlare } from './post/SunFlare.js';
import { godRays, grade, speedLines, uSaturation } from './post/Cinematic.js';
import { Motes, MOTE_LAYERS } from './sea/Motes.js';
import { Shells } from './sea/Shells.js';
import { Puffs } from './sea/Puffs.js';
import { TweakPanel } from './ui/TweakPanel.js';
import { FlyCamera } from './core/FlyCamera.js';
import { ChaseCamera, MOTION } from './core/ChaseCamera.js';
import { Title, TITLE } from './ui/Title.js';
import { AutoExposure } from './post/Exposure.js';
import { loadAssets } from './world/Assets.js';
import { SeaHeight } from './sea/SeaHeight.js';
import { Volume, VOLUME } from './sea/Volume.js';
import { Surfer } from './player/Surfer.js';
import { Wake } from './player/Wake.js';
import { Port, RING_OUT } from './world/Port.js';
import { Npcs } from './world/Npcs.js';
import { Walker } from './player/Walker.js';
import { WalkCamera } from './core/WalkCamera.js';
import { Dialogue } from './ui/Dialogue.js';
import { Compass } from './ui/Compass.js';
import { SeaMap } from './ui/SeaMap.js';
import { QUARTERMASTER, TRADER, PILOT, STARGAZER } from './game/Characters.js';
import { RINGS } from './game/Rings.js';
import { Rings } from './world/Rings.js';
import { Rim, uLens } from './world/Rim.js';
import { RIM } from './game/Rim.js';
import { Save } from './game/Save.js';
import { REWARDS } from './game/Rewards.js';
import { Combo, TRICK } from './game/Tricks.js';
import { Stardust } from './world/Stardust.js';
import { Leviathans } from './world/Leviathans.js';
import { Galleon, HELM_SPOT } from './world/Galleon.js';
import { Regions } from './world/Regions.js';
import { Outpost } from './world/Outpost.js';
import { REACH } from './game/Flares.js';
import { Audio } from './audio/Audio.js';
import { WhaleSong } from './audio/WhaleSong.js';
import { Courier } from './game/Courier.js';
import { Race } from './game/Race.js';
import { COURSES, RACE } from './game/Races.js';
import { UPGRADES, DEEDS, applyUpgrades, tierName, BOARD } from './game/Gear.js';
import { Grinds, GRIND } from './game/Grinds.js';
import { SPAWN, OUTPOST, FROSTWATER, HORIZON, REGIONS, HARBOR } from './world/WorldLayout.js';
import { WIND } from './world/Wind.js';
import { Spray } from './player/Spray.js';
import { Input } from './core/Input.js';

// seconds -> m:ss.t
const formatTime = ( t ) => `${ Math.floor( t / 60 ) }:${ ( t % 60 ).toFixed( 1 ).padStart( 4, '0' ) }`;

// Top-level app: owns the renderer, scene, camera and the frame loop.
// Systems are added here as milestones land (see docs/roadmap.md).
export class App {

	constructor( container ) {

		this.container = container;
		this.params = new URLSearchParams( location.search );
		this.save = new Save();
		this.audio = new Audio( this.params );
		applyUpgrades( this.save.data.upgrades );
		// another tab saved (or a slot switch): take its upgrades too
		this.save.onExternal( ( d ) => {

			applyUpgrades( d.upgrades );
			this.tweaks?.gui.controllersRecursive().forEach( ( c ) => c.updateDisplay() );

		} );

		// temporal AA (TRAA, in buildPipeline) replaces MSAA; ?noTAA brings MSAA back
		this.renderer = new THREE.WebGPURenderer( { antialias: this.params.has( 'noTAA' ) } );
		this.renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.sizeBeauty();
		// ACES keeps the nebula colours vivid (AgX washed them grey); ?noCinematic turns off the
		// cinematic post (god rays, grade) for comparison
		this.cinematic = ! this.params.has( 'noCinematic' );
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
		await loadAssets(); // CC0 textures and models (world/Assets.js), before the world is built
		const gpu = this.renderer.backend.device?.adapterInfo || this.renderer.backend.adapter?.info;
		if ( gpu ) console.info( `[etherwake] GPU: ${ gpu.vendor } ${ gpu.architecture } ${ gpu.description || '' }` );
		// ?stats: frame rate, the slowest frame of the last second, the GPU and the canvas size
		if ( this.params.has( 'stats' ) ) {

			this.statsEl = document.createElement( 'div' );
			this.statsEl.style.cssText = 'position:fixed;left:12px;top:12px;font:12px monospace;color:#bff4ee;text-shadow:0 1px 2px #000;pointer-events:none;z-index:20';
			document.body.appendChild( this.statsEl );
			this.stats = { frames: 0, worst: 0, since: performance.now(), last: performance.now(), gpu: gpu ? `${ gpu.vendor } ${ gpu.architecture }` : '?' };

		}

		this.sea = new Etherium( this.scene );
		this.starfield = new Starfield( this.scene, { horizon: this.sea.uFogColor, underwater: this.sea.uUnderwater, sun: this.sea.uSunDir } );
		this.giant = new GasGiant( this.scene, this.sea.uSunDir );
		this.moon = new Moon( this.scene, this.sea.uSunDir );
		if ( ! this.params.has( 'noPuffs' ) ) this.puffs = new Puffs( this.scene, this.sea );
		if ( this.params.has( 'shells' ) ) this.shells = new Shells( this.scene, this.sea );
		this.motes = this.params.has( 'noMotes' ) ? [] : Object.values( MOTE_LAYERS ).map( ( layer ) => new Motes( this.scene, this.sea, layer ) );
		this.tweaks = new TweakPanel( this );
		this.buildPipeline();
		if ( ! this.params.has( 'noReflections' ) ) this.buildEnvironment();
		this.buildLights();

		this.port = new Port( this.scene );
		this.surfer = new Surfer( this.scene, this.sea );
		this.surfer.reset( SPAWN.x, SPAWN.z, SPAWN.yaw );
		this.wake = new Wake( this.scene, this.sea );
		this.spray = new Spray( this.scene );
		this.chase = new ChaseCamera( this.camera, this.sea, this.cameraClearance ? { clearance: this.cameraClearance } : {} );
		this.surfer.onLand = ( r ) => this.onLand( r );
		// tricks chain into combos (game/Tricks.js)
		this.combo = new Combo();
		this.comboEl = document.getElementById( 'combo' );
		this.surfer.onTrick = ( name, points ) => {

			this.combo.add( name, points );
			this.showCombo();

		};
		this.chase.snap( this.surfer );
		this.walker = new Walker( this.scene );
		this.walkCam = new WalkCamera( this.camera, this.input, this.port.cameraObstacles );
		this.npcs = new Npcs( this.scene, this.port, this.sea );
		this.dialogue = new Dialogue();
		this.hud = document.getElementById( 'hud' );
		this.toastEl = document.getElementById( 'toast' );
		this.promptEl = document.getElementById( 'prompt' );
		this.stardust = new Stardust( this.scene, this.sea );
		this.leviathans = new Leviathans( this.scene, this.sea );
		this.galleon = new Galleon( this.scene, this.sea, this.save.data.galleon );
		this.grinds = new Grinds( this.scene, this.galleon );
		this.balanceEl = document.getElementById( 'balance' );
		this.regions = new Regions( this.scene, this.sea );
		this.regions.onSunstone = ( pos ) => this.onSunstone( pos );
		this.outposts = [
			new Outpost( this.scene, this.sea, { at: OUTPOST, npc: TRADER } ),
			new Outpost( this.scene, this.sea, { at: FROSTWATER, npc: PILOT, canvas: 0x2a5a7a, glow: [ 1.2, 2.6, 3.6 ], light: 0x60c0ff } ),
			new Outpost( this.scene, this.sea, { at: HORIZON, npc: STARGAZER, canvas: 0x3a1a5a, glow: [ 2.6, 1.2, 3.8 ], light: 0xa060ff } )
		];
		this.rim = new Rim( this.scene, this.sea );
		this.rim.onPearl = ( pos ) => {

			this.spray.burst( { position: pos, velocity: this.surfer.velocity }, 14 );
			this.toast( `Void pearl · +${ this.earn( RIM.pearl ) } ✦${ this.reachTag }` );

		};
		// the Ring Reach's ice keeps clear of the Shard Slalom's gates
		const slalom = COURSES.find( ( c ) => c.id === 'slalom' ), rc = REGIONS.rings;
		this.rings = new Rings( this.scene, this.sea, slalom.gates.map( ( [ a, r ] ) => ( { x: rc.x + Math.cos( a * Math.PI / 180 ) * r, z: rc.z + Math.sin( a * Math.PI / 180 ) * r } ) ) );
		this.rings.onShave = () => this.toast( `Close shave · +${ this.earn( RINGS.closeShave ) } ✦${ this.reachTag }` );
		this.rings.onCrystal = ( pos ) => {

			this.spray.burst( { position: pos, velocity: this.surfer.velocity }, 10 );
			this.toast( `Rime crystal · +${ this.earn( RINGS.crystal ) } ✦${ this.reachTag }` );

		};
		this.shipCam = new ChaseCamera( this.camera, this.sea, { distance: 42, height: 16, lookAhead: 25, lookUp: 6, follow: 2.5, aim: 5, clearance: 4 } );
		this.walkCam.obstacles = [ ...this.port.cameraObstacles, ...this.galleon.cameraObstacles ];
		this.song = new WhaleSong( this.audio, this.leviathans );
		this.stardust.onCollect = ( pos, trailDone ) => this.onStardust( pos, trailDone );
		this.creditsEl = document.getElementById( 'credits' );
		this.objectiveEl = document.getElementById( 'objective' );
		this.compass = new Compass();
		this.seaMap = new SeaMap();
		this.courier = new Courier( this.scene, this.sea, this.surfer );
		this.race = new Race( this.scene, this.sea );
		const dockmaster = this.npcs.list.find( ( n ) => n.id === 'dockmaster' );
		this.courier.dropoff = dockmaster.buoy.position;
		this.atDropoff = ( p ) => Math.hypot( p.x - dockmaster.buoy.position.x, p.z - dockmaster.buoy.position.z ) < 7;
		this.save.onChange( ( d ) => this.showCredits( d.credits ) );
		this.setMode( this.params.has( 'fly' ) ? 'fly' : 'surf' );
		if ( ! this.params.has( 'noTitle' ) && ! this.params.has( 'fly' ) ) this.title = new Title( this.save.data, () => this.chase.snap( this.surfer ) );

		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );

	}

	// For automated tests, first thing on every page load: a throwaway save slot and no audio, for this
	// page session only (the player's real save and audio settings are untouched). __ew.testMode()
	testMode() {

		this.save.useSlot( 'test' );
		this.audio.disableForSession();
		this.title?.close();
		return 'test mode: save slot "test", audio off';

	}

	// Scene pass plus bloom (skip with ?noBloom). Tone mapping and sRGB happen in the pipeline output.
	buildPipeline() {

		this.pipeline = new THREE.RenderPipeline( this.renderer );
		this.uSpeedFx = uniform( 0 ); // 0..1 from the board's speed: speed lines (see MOTION.speed)
		const scenePass = pass( this.scene, this.camera );
		let scene = scenePass.getTextureNode( 'output' );
		// temporal AA: the camera jitters a sub-pixel each frame and TRAA blends the history, reprojected
		// by per-pixel velocity (graphics pass 3, slice 1)
		if ( ! this.params.has( 'noTAA' ) ) {

			scenePass.setMRT( mrt( { output, velocity } ) );
			this.traa = traa( scene, scenePass.getTextureNode( 'depth' ), scenePass.getTextureNode( 'velocity' ), this.camera );
			scene = this.traa.getTextureNode();

		}
		// the volumetric etherium: raymarched near the camera and composited over the scene *after* TRAA.
		// (Before it, the cloud pixels had no motion vectors, the near sea mesh being cut away there, so
		// TRAA reprojected them as if static: on a fast turn the clouds lagged a frame and snapped back.)
		// ?noVolume keeps the mesh-only sea (graphics pass 3, slice 2)
		if ( ! this.params.has( 'noVolume' ) ) {

			this.seaHeight = new SeaHeight( this.sea );
			this.volume = new Volume( this.sea, this.seaHeight, scenePass.getTextureNode( 'depth' ), this.camera );
			this.sea.useVolume( VOLUME.range );
			this.cameraClearance = VOLUME.cameraClear; // look down onto the cloud tops, not through them
			if ( this.puffs ) this.puffs.mesh.visible = false;
			// a texture of its own (the lens warp, bloom and god rays below sample it)
			scene = this.beauty = rtt( this.volume.composite( scene ) );
			this.sizeBeauty();

		}
		// gravitational lensing around the Rim's black hole: pixels near it sample the scene closer to
		// its centre (so what's behind is magnified outward into an Einstein ring), and the horizon is black
		const lens = Fn( () => {

			const aspect = screenSize.x.div( screenSize.y );
			const d = screenUV.sub( uLens.xy ).mul( vec2( aspect, 1 ) );
			const r = length( d ).max( 1e-4 ), rs = uLens.z, on = uLens.w;
			const warp = rs.mul( rs ).mul( RIM.hole.lens ).div( r.max( rs.mul( 0.9 ) ) );
			return vec4( screenUV.sub( d.div( r ).mul( warp ).div( vec2( aspect, 1 ) ).mul( on ) ), r, rs );

		} )();
		// clamped (max/min also drop a NaN on GPUs): bloom's blur spreads one bad pixel into black blocks
		const color = scene.sample( lens.xy ).max( 0 ).min( 60000 );
		// the event horizon stays black: masked after bloom so no glow bleeds across it
		const horizon = mix( float( 1 ), smoothstep( lens.w.mul( 0.97 ), lens.w.mul( 1.03 ), lens.z ), uLens.w );
		this.flare = new SunFlare( this.sea.uSunDir );
		let out = color.add( this.flare.node );
		if ( ! this.params.has( 'noAutoExposure' ) ) this.exposure = new AutoExposure( scene );
		if ( ! this.params.has( 'noBloom' ) ) {

			this.bloom = bloom( color, 0.55, 0.45, 0.85 );
			out = out.add( this.bloom );

		}
		if ( this.cinematic ) {

			out = out.add( godRays( scene, this.flare.uSun, this.flare.uVis ) );
			out = out.add( speedLines( this.uSpeedFx, this.sea.uTime ) );
			this.pipeline.outputNode = grade( out.rgb.mul( horizon ), this.sea.uTime );

		} else this.pipeline.outputNode = vec4( out.rgb.mul( horizon ), 1 );

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
		this.onFoot = mode === 'walk' || mode === 'helm' || ( mode === 'fly' && ( this.returnMode === 'walk' || this.returnMode === 'helm' ) );
		this.walker.visible = this.onFoot;
		this.surfer.riderVisible = ! this.onFoot;
		this.fly.enabled = mode === 'fly';
		if ( mode === 'fly' ) this.fly.euler.setFromQuaternion( this.camera.quaternion );
		else if ( mode === 'walk' ) this.walkCam.snap( this.walker );
		else if ( mode === 'helm' ) this.shipCam.snap( this.galleon );
		else this.chase.snap( this.surfer );
		this.hudHint = {
			fly: 'FLY · click to look · WASD · Space/C up/down · Shift fast · F back · H tweaks',
			walk: 'WASD walk · Shift run · mouse or ←/→ camera · E interact · F fly · H tweaks',
			helm: 'A/D steer · W more sail · S less sail · E leave the helm · F fly · M mute · H tweaks',
			surf: `A/D carve · W sail · S brake · Space jump · J+dir flip · K+dir grab · L grind · R reset · F fly · Tab map${ this.save.data.ownsGalleon ? ' · G galleon' : '' } · M mute · H tweaks`
		}[ mode ];

	}

	// step up onto a platform (the boardwalk or the galleon's deck) at `spot` ( { platform, x, z } in the
	// platform's coordinates), facing away from the board; the board stays floating where you left it
	dock( spot ) {

		const s = this.surfer, pf = spot.platform;
		s.velocity.set( 0, 0, 0 );
		const w = pf.toWorld( new THREE.Vector3( spot.x, pf.deckY, spot.z ), new THREE.Vector3() );
		this.walker.place( pf, spot.x, spot.z, Math.atan2( w.x - s.position.x, w.z - s.position.z ) - pf.yaw );
		this.setMode( 'walk' );

	}

	// pick up the board and drop in at `edge` (a sea spot just off the deck), heading out
	launch( edge ) {

		this.surfer.reset( edge.x, edge.z, edge.yaw );
		// off a ship under way: you keep her speed
		if ( this.walker.platform === this.galleon.platform ) this.surfer.velocity.add( this.galleon.velocity );
		this.setMode( 'surf' );

	}

	frame( time ) {

		if ( this.stats ) this.updateStats();
		this.clock.update( time );
		const dt = Math.max( 0, Math.min( this.clock.getDelta(), 0.1 ) );
		const input = this.input;
		if ( this.title?.open ) input.keys.clear(), input.pressed.clear(); // nothing steers while the title is up

		if ( input.wasPressed( 'KeyF' ) ) this.setMode( this.mode === 'fly' ? this.returnMode : 'fly' );

		this.time += dt;
		this.sea.update( this.time, this.camera );

		const surf = this.mode === 'surf', walk = this.mode === 'walk';
		const key = ( c ) => input.down( c ) ? 1 : 0;
		// the direction held for a trick (game/Tricks.js tables are keyed by it)
		const trickDir = () => input.down( 'KeyW' ) ? 'W' : input.down( 'KeyS' ) ? 'S' : input.down( 'KeyA' ) ? 'A' : input.down( 'KeyD' ) ? 'D' : 'none';

		// board: ridden, or parked in its slip while on foot
		if ( this.onFoot ) this.surfer.park( dt );
		else {

			if ( surf && input.wasPressed( 'KeyR' ) ) this.surfer.reset( this.surfer.position.x, this.surfer.position.z );
			if ( surf && input.wasPressed( 'KeyG' ) ) this.summonGalleon();
			if ( this.dialogue.active ) this.surfer.velocity.multiplyScalar( Math.exp( - 2 * dt ) ); // hold still while talking
			if ( surf && ! this.dialogue.active ) this.updateGrind( dt, input, key );
			this.surfer.update( dt, surf && ! this.dialogue.active ? {
				steer: key( 'KeyD' ) - key( 'KeyA' ),
				throttle: key( 'KeyW' ) - key( 'KeyS' ),
				jump: input.wasPressed( 'Space' ),
				flip: input.wasPressed( 'KeyJ' ) ? trickDir() : null,
				grab: input.down( 'KeyK' ) ? trickDir() : null
			} : {} );
			if ( ! this.surfer.grinding ) {

				this.port.collide( this.surfer );
				this.leviathans.collide( this.surfer );
				this.galleon.collide( this.surfer );
				for ( const o of this.outposts ) o.collide( this.surfer );

			}
			// the Rim: a swirling current carries you round, and the air is light
			const sp = this.surfer.position;
			this.surfer.velocity.addScaledVector( this.rim.current( sp.x, sp.z, this._current || ( this._current = new THREE.Vector3() ) ), dt );
			this.surfer.gravityScale = this.rim.gravityAt( sp.x, sp.z );
			this.rideBowWave( dt );
			this.rideFlare( dt );
			this.updateCombo( dt );

		}

		this.interact( input );
		if ( walk && ! this.dialogue.active ) {

			this.walker.update( dt, { forward: key( 'KeyW' ) - key( 'KeyS' ), right: key( 'KeyD' ) - key( 'KeyA' ), run: input.down( 'ShiftLeft' ) }, this.walkCam.yaw );

		}
		this.npcs.update( dt, this.onFoot ? this.walker.position : this.surfer.position );
		this.port.update( dt, WIND.angle );
		this.leviathans.update( dt );
		const helm = this.mode === 'helm' && ! this.dialogue.active;
		for ( const o of this.outposts ) o.update( dt );
		this.rings.update( dt, this.onFoot ? null : this.surfer );
		this.rim.update( dt, this.camera, this.onFoot ? null : this.surfer );
		this.galleon.update( dt, helm ? { steer: key( 'KeyD' ) - key( 'KeyA' ), sail: key( 'KeyW' ) - key( 'KeyS' ) } : null );
		if ( this.mode === 'helm' && this.time > ( this.poseSavedAt || 0 ) + 5 ) this.saveShipPose();
		if ( this.onFoot ) this.walker.sync(); // the deck may have moved under you
		this.song.update( dt, this.camera.position );
		this.audio.update( this.camera );
		this.spotPod();
		this.onRegion( this.regions.update( dt, this.camera.position, this.onFoot ? null : this.surfer.position ) );
		const look = this.regions.look;
		this.renderer.toneMappingExposure = look.exposure * ( this.exposure ? this.exposure.update( dt ) : 1 );
		if ( this.bloom ) this.bloom.strength.value = look.bloom;
		uSaturation.value = look.saturation;
		this.spotGalleon();
		if ( ! this.onFoot ) this.stardust.update( dt, this.surfer );
		this.onCourier( this.courier.update( dt, this.surfer, this.onFoot ? () => false : this.atDropoff ) );
		this.onRace( this.race.update( dt, this.surfer ) );
		if ( this.race.boosted ) {

			this.fovKick = 1;
			this.spray.burst( this.surfer, 24 );

		}
		// boost: the field of view widens briefly and eases back
		this.fovKick = ( this.fovKick || 0 ) * Math.exp( - 2.5 * dt );
		// speed: a wider view, speed lines and a faint rumble build up as you go faster
		const M = MOTION.speed;
		const want = surf ? Math.max( 0, Math.min( 1, ( this.surfer.speed - M.from ) / ( M.to - M.from ) ) ) : 0;
		this.speedFx = ( this.speedFx || 0 ) + ( want - ( this.speedFx || 0 ) ) * ( 1 - Math.exp( - 3 * dt ) );
		this.uSpeedFx.value = this.speedFx * M.lines;
		this.chase.rumble = this.speedFx;
		const fov = 60 + this.fovKick * 14 + this.speedFx * M.fov;
		if ( Math.abs( fov - this.camera.fov ) > 0.01 ) {

			this.camera.fov = fov;
			this.camera.updateProjectionMatrix();

		}
		this.wake.update( dt, this.surfer );
		this.spray.update( dt, this.surfer );

		if ( surf ) this.chase.update( dt, this.surfer );
		else if ( walk ) this.walkCam.update( dt, this.walker );
		else if ( this.mode === 'helm' ) this.shipCam.update( dt, this.galleon );
		else this.fly.update( dt );

		this.giant.update( this.time, this.camera );
		this.moon.update( this.camera );
		this.flare.update( this.camera );
		for ( const m of this.motes ) m.update( this.camera, this.surfer );
		if ( this.shells ) this.shells.update();
		if ( this.puffs ) this.puffs.update( this.camera, this.surfer );
		if ( this.title?.open ) this.titleOrbit();
		this.updateHud();
		this.updateObjective();
		if ( input.wasPressed( 'Tab' ) ) this.seaMap.toggle();
		this.updateNavigation();
		input.endFrame();
		if ( this.volume ) {

			this.seaHeight.update( this.camera );
			this.volume.update( this.onFoot ? null : this.surfer, this.camera, this.galleon );

		}
		this.pipeline.render();
		this.exposure?.measure( this.renderer );

	}

	// E to dock, launch or talk (E / Space advance dialogue); shows the matching prompt
	interact( input ) {

		const e = input.wasPressed( 'KeyE' );
		let prompt = '';
		if ( this.dialogue.active ) {

			if ( this.dialogue.atChoice ) {

				const pick = this.dialogue.choices.find( ( c ) => input.wasPressed( c.key ) );
				if ( pick ) this.dialogue.choose( pick.key );

			} else if ( e || input.wasPressed( 'Space' ) ) this.dialogue.next();

		} else if ( this.mode === 'surf' && this.surfer.grounded ) {

			// slow near a mooring buoy: talk from the board; near any deck edge: step up
			const s = this.surfer;
			// slow for the port; matching speed for the galleon (she may be under way)
			const slow = s.speed < 10;
			const matched = Math.hypot( s.velocity.x - this.galleon.velocity.x, s.velocity.z - this.galleon.velocity.z ) < 8;
			const station = this.outposts.find( ( o ) => o.nearMooring( s.position ) );
			const npc = ! slow ? null : station ? station.npc : this.npcs.nearestMooring( s.position );
			const spot = npc ? null : ( slow && this.port.dockPoint( s.position.x, s.position.z ) ) || ( matched && this.galleon.dockPoint( s.position.x, s.position.z ) );
			if ( npc ) {

				prompt = `E · talk to the ${ npc.name.toLowerCase() }`;
				if ( e ) this.talkTo( npc );

			} else if ( spot ) {

				prompt = spot.platform === this.galleon.platform ? 'E · climb aboard' : 'E · step onto the dock';
				if ( e ) this.dock( spot );

			}

		} else if ( this.mode === 'walk' ) {

			const wk = this.walker, w = wk.position;
			const onShip = wk.platform === this.galleon.platform;
			const npc = onShip ? null : this.npcs.nearest( w );
			const crew = onShip && this.galleon.crewPosition().distanceTo( w ) < 2.8;
			const atHelm = onShip && Math.hypot( wk.local.x - HELM_SPOT.x, wk.local.z - HELM_SPOT.z ) < 1.6;
			const edge = npc || crew || atHelm ? null : wk.platform.launchEdge( wk.local.x, wk.local.z );
			if ( atHelm ) {

				if ( this.save.data.ownsGalleon ) {

					prompt = 'E · take the helm';
					if ( e ) {

						wk.place( this.galleon.platform, HELM_SPOT.x, HELM_SPOT.z, 0 );
						this.setMode( 'helm' );

					}

				} else prompt = 'The helm is lashed · the shipwright holds her deed';

			} else if ( npc ) {

				prompt = `E · talk to the ${ npc.name.toLowerCase() }`;
				if ( e ) this.talkTo( npc );

			} else if ( crew ) {

				prompt = 'E · talk to the quartermaster';
				if ( e ) this.dialogue.open( QUARTERMASTER.name, this.save.data.ownsGalleon ? QUARTERMASTER.ownedLines : QUARTERMASTER.lines );

			} else if ( edge ) {

				prompt = 'E · drop in with the board';
				if ( e ) this.launch( edge );

			}

		} else if ( this.mode === 'helm' && e ) {

			// leave the helm: the sails furl and she coasts to a stop
			this.galleon.sail = 0;
			this.saveShipPose();
			this.setMode( 'walk' );

		}
		if ( this.dialogue.active ) prompt = '';
		if ( prompt !== this.promptText ) {

			this.promptText = prompt;
			this.promptEl.textContent = prompt;
			this.promptEl.style.opacity = prompt ? 1 : 0;

		}

	}

	// Characters with something to offer build their conversation here; others just chat.
	talkTo( npc ) {

		if ( [ 'shipwright', 'trader', 'pilot', 'stargazer' ].includes( npc.id ) ) return this.openShop( npc );
		if ( npc.id === 'marshal' ) return this.openRaces( npc );
		if ( npc.id !== 'dockmaster' ) return this.dialogue.open( npc.name, npc.lines );
		const c = this.courier;
		if ( c.state !== 'idle' ) {

			return this.dialogue.open( npc.name, [ c.state === 'fetch' ? "That parcel won't fetch itself. Clock's ticking!" : 'Is that my parcel? Bring it right up to the mooring.' ], [
				{ key: 'KeyE', label: 'E · on my way' },
				{ key: 'KeyQ', label: 'Q · abandon the job', action: () => {

					c.abandon();
					this.toast( 'Job abandoned' );

				} }
			] );

		}
		const o = c.makeOffer();
		const clock = `${ Math.floor( o.time / 60 ) }:${ String( o.time % 60 ).padStart( 2, '0' ) }`;
		this.dialogue.open( npc.name, [
			npc.lines[ 0 ],
			`Got a parcel bobbing at a buoy about ${ o.dist } m ${ o.heading } of here. Bring it to my mooring within ${ clock } and it's ${ o.pay } credits. Quicker than half that, I'll add a bonus.`
		], [
			{ key: 'KeyE', label: 'E · accept', action: () => {

				c.accept();
				this.toast( 'Courier job: follow the teal beacon' );

			} },
			{ key: 'KeyQ', label: 'Q · not now' }
		] );

	}

	// The shipwright's shop: 1-4 buys the next tier of an upgrade line, Q leaves. Buying reopens the shop.
	openShop( npc, line = null ) {

		const choices = UPGRADES.map( ( up, i ) => {

			const level = this.save.level( up.id ), next = up.tiers[ level ];
			const label = next ? `${ i + 1 } · ${ tierName( up, level + 1 ) } (${ up.blurb }) · ${ next.cost } ✦` : `${ i + 1 } · ${ tierName( up, level ) } · fitted, the best I make`;
			return { key: `Digit${ i + 1 }`, label, action: () => this.buy( npc, up ) };

		} );
		if ( ! this.save.data.ownsGalleon ) {

			const d = DEEDS.galleon;
			choices.push( { key: 'Digit5', label: `5 · ${ d.name } · ${ d.cost } ✦`, action: () => this.buyDeed( npc ) } );

		}
		if ( npc.id === 'pilot' ) choices.push( this.raceChoice( COURSES.find( ( c ) => c.id === 'slalom' ), 'KeyR', 'R' ) );
		choices.push( { key: 'KeyQ', label: 'Q · that’s all' } );
		this.dialogue.open( npc.name, [ line || npc.greeting || `What'll it be? You've got ${ this.save.credits } ✦ to spend.` ], choices );

	}

	buyDeed( npc ) {

		const d = DEEDS.galleon;
		let line;
		if ( ! this.save.spend( d.cost ) ) line = `She's ${ d.cost } ✦ and you've got ${ this.save.credits }. She'll wait for you.`;
		else {

			this.save.data.ownsGalleon = true;
			this.save.changed();
			this.toast( 'The solar galleon is yours!' );
			line = "Signed and sealed. She's anchored north, past the whales. Take the helm and she'll sail where you point her.";

		}
		this.openShop( npc, line );

	}

	// remember where the galleon lies, so she's there next time
	saveShipPose() {

		this.poseSavedAt = this.time;
		this.save.data.galleon = this.galleon.pose;
		this.save.changed();

	}

	buy( npc, up ) {

		const level = this.save.level( up.id ), next = up.tiers[ level ];
		let line;
		if ( ! next ) line = "That's as good as she gets. Anything else?";
		else if ( ! this.save.spend( next.cost ) ) line = `That's ${ next.cost } ✦ and you've got ${ this.save.credits }. Go earn some more.`;
		else {

			this.save.setLevel( up.id, level + 1 );
			applyUpgrades( this.save.data.upgrades );
			this.tweaks.gui.controllersRecursive().forEach( ( c ) => c.updateDisplay() );
			this.toast( `${ tierName( up, level + 1 ) } fitted` );
			line = `${ tierName( up, level + 1 ) }, fitted. You'll feel it. Anything else?`;

		}
		this.openShop( npc, line );

	}

	// The race marshal: pick a course (1, 2, ...) with your best time and the medal times, or Q.
	// Mid-race, talking offers to abandon it.
	openRaces( npc ) {

		if ( this.race.state === 'running' ) {

			return this.dialogue.open( npc.name, [ "You're mid-race! The gates won't wait." ], [
				{ key: 'KeyE', label: 'E · back to it' },
				{ key: 'KeyQ', label: 'Q · abandon the race', action: () => {

					this.race.stop();
					this.toast( 'Race abandoned' );

				} }
			] );

		}
		// the marshal runs the harbour courses; region courses are run by their own station
		const choices = COURSES.filter( ( c ) => ! c.center ).map( ( c, i ) => this.raceChoice( c, `Digit${ i + 1 }`, String( i + 1 ) ) );
		choices.push( { key: 'KeyQ', label: 'Q · not now' } );
		this.dialogue.open( npc.name, npc.lines, choices );

	}

	// a dialogue choice that starts race course `c`: its name, best time and medal times
	raceChoice( c, key, label ) {

		const best = this.save.data.races[ c.id ];
		const bestText = best ? `best ${ formatTime( best ) }` : 'no time yet';
		return {
			key,
			label: `${ label } · ${ c.name } · ${ c.gates.length } gates · ${ bestText } · gold ${ formatTime( c.gold ) }, silver ${ formatTime( c.silver ) }`,
			action: () => {

				if ( this.courier.state !== 'idle' ) this.courier.abandon();
				this.race.start( c.id );
				this.toast( `${ c.name } · ride through the first gate to start the clock` );

			}
		};

	}

	onRace( event ) {

		if ( event === 'start' ) this.toast( 'Go!' );
		else if ( event === 'gate' ) this.spray.burst( this.surfer, 10 );
		else if ( event === 'finish' ) {

			const c = this.race.course, t = this.race.time, P = RACE.pay;
			const prev = this.save.data.races[ c.id ];
			const medal = t <= c.gold ? 'gold' : t <= c.silver ? 'silver' : null;
			let pay = medal ? P[ medal ] : P.finish;
			const best = ! prev || t < prev;
			if ( best ) {

				if ( prev ) pay += RACE.bestBonus;
				this.save.data.races[ c.id ] = +t.toFixed( 2 );

			}
			this.save.addCredits( pay );
			this.toast( `${ c.name } · ${ formatTime( t ) }${ medal ? ` · ${ medal }!` : '' }${ best ? ' · new best' : '' } · +${ pay } ✦` );

		}

	}

	// First sight of the pod (within 300 m) gets a callout, at most every few minutes.
	spotPod() {

		const p = this.onFoot ? this.walker.position : this.surfer.position;
		const near = this.leviathans.whales.some( ( w ) => w.mesh.position.distanceTo( p ) < 300 );
		if ( near && this.time > ( this.podSeenAt ?? - Infinity ) + 180 ) {

			this.podSeenAt = this.time;
			this.toast( 'A leviathan pod!' );

		}

	}

	// Reaching the galleon for the first time (saved) gets a callout.
	// while the title is up the camera circles slowly round the harbour, looking out over the sea
	titleOrbit() {

		const O = TITLE.orbit, a = this.time * O.speed;
		const cx = SPAWN.x - 20, cz = SPAWN.z;
		const x = cx + Math.cos( a ) * O.radius, z = cz + Math.sin( a ) * O.radius;
		this.camera.position.set( x, this.sea.heightAt( x, z ) + O.height, z );
		this.camera.lookAt( cx + Math.cos( a + 1.2 ) * O.radius * 2, O.lookUp, cz + Math.sin( a + 1.2 ) * O.radius * 2 );

	}

	// G while surfing (once you own her): the galleon heaves to alongside you, parallel to your heading,
	// at the first spot clear of the harbour, the outposts, the ice spire and the shards
	summonGalleon() {

		if ( ! this.save.data.ownsGalleon ) return this.toast( 'No ship to call · the shipwright holds her deed' );
		const s = this.surfer, yaw = s.yaw, p = s.position;
		const spot = this.galleonSpot( p.x, p.z, yaw );
		if ( ! spot ) return this.toast( 'No clear water for her here' );
		this.galleon.moveTo( spot.x, spot.z, yaw );
		this.saveShipPose();
		this.toast( 'The galleon heaves to alongside' );

	}

	galleonSpot( px, pz, yaw ) {

		const obstacles = [
			{ x: HARBOR.x, z: HARBOR.z, r: RING_OUT + 30 },
			...[ OUTPOST, FROSTWATER, HORIZON ].map( ( o ) => ( { x: o.x, z: o.z, r: 50 } ) ),
			{ x: REGIONS.rings.x, z: REGIONS.rings.z, r: 70 }, // the ice spire
			...this.rings.shards.map( ( sh ) => ( { x: sh.x, z: sh.z, r: sh.scale + 4 } ) )
		];
		const fx = Math.sin( yaw ), fz = Math.cos( yaw ); // the ship lies along your heading
		const clear = ( x, z ) => {

			for ( let a = - 20; a <= 26; a += 4 ) { // stern to bowsprit tip, beam ~5 m each side

				const cx = x + fx * a, cz = z + fz * a;
				for ( const o of obstacles ) if ( Math.hypot( cx - o.x, cz - o.z ) < o.r + 6 ) return false;

			}
			return true;

		};
		for ( const d of [ 45, 60, 80, 110, 150 ] ) for ( const ang of [ 1.5708, - 1.5708, 1.1, - 1.1, 2.0, - 2.0, 0, Math.PI ] ) {

			const c = Math.cos( ang ), sn = Math.sin( ang ); // rotate the heading by ang
			const x = px + ( fx * c + fz * sn ) * d, z = pz + ( fz * c - fx * sn ) * d;
			if ( clear( x, z ) ) return { x, z };

		}
		return null;

	}

	spotGalleon() {

		if ( this.save.data.foundGalleon ) return;
		const p = this.onFoot ? this.walker.position : this.surfer.position, g = this.galleon.group.position;
		if ( Math.hypot( p.x - g.x, p.z - g.z ) < 120 ) {

			this.save.data.foundGalleon = true;
			this.save.changed();
			this.toast( 'The solar galleon!' );

		}

	}

	onRegion( e ) {

		if ( ! e ) return;
		if ( e.type === 'enter' ) {

			this.toast( `Entering ${ e.name }` );
			this.save.data[ `found:${ e.name }` ] = true;
			this.save.changed();

		} else if ( e.type === 'leave' ) this.toast( `Leaving ${ e.name }` );
		else if ( e.type === 'warning' ) this.toast( 'A flare is building…' );
		else if ( e.type === 'launch' ) this.toast( 'Flare-front! Ride it away from the sun' );

	}

	// Riding a flare-front (on the board, on its lifted face, moving): a big bonus every few seconds.
	rideFlare( dt ) {

		const s = this.surfer, p = s.position;
		const riding = s.grounded && s.speed > 10 && flareHeightAt( p.x, p.z ) > REWARDS.flareLift;
		this.flareGrace = riding ? 1 : Math.max( 0, ( this.flareGrace || 0 ) - dt );
		if ( this.flareGrace <= 0 ) {

			this.flareTime = 0;
			return;

		}
		if ( riding ) this.flareTime = ( this.flareTime || 0 ) + dt;
		if ( this.flareTime >= REWARDS.flareEvery ) {

			this.flareTime -= REWARDS.flareEvery;
			const got = this.earn( REWARDS.flare );
			this.save.stat( 'flareRides', ( n ) => n + 1 );
			this.toast( `Riding the flare! · +${ got } ✦${ this.reachTag }` );

		}

	}

	// Riding a leviathan's bow wave (on the board, on its lifted surface): a small bonus every few seconds.
	rideBowWave( dt ) {

		const s = this.surfer, p = s.position;
		const riding = s.grounded && s.speed > 6 && bowHeightAt( p.x, p.z ) > REWARDS.bowLift;
		this.bowGrace = riding ? 1 : Math.max( 0, ( this.bowGrace || 0 ) - dt );
		if ( this.bowGrace <= 0 ) {

			this.bowTime = 0;
			return;

		}
		if ( riding ) this.bowTime = ( this.bowTime || 0 ) + dt;
		if ( this.bowTime >= REWARDS.bowEvery ) {

			this.bowTime -= REWARDS.bowEvery;
			const got = this.earn( REWARDS.bow );
			this.save.stat( 'bowRides', ( n ) => n + 1 );
			this.toast( `Riding with the leviathans · +${ got } ✦${ this.reachTag }` );

		}

	}

	onCourier( event ) {

		if ( event === 'picked' ) this.toast( 'Parcel aboard · back to the dockmaster' );
		else if ( event === 'failed' ) this.toast( 'Out of time · the parcel drifted off' );
		else if ( event === 'delivered' ) {

			const pay = this.courier.payout, quick = pay > this.courier.job.pay;
			this.save.addCredits( pay );
			this.save.stat( 'jobs', ( n ) => n + 1 );
			this.toast( `Delivered${ quick ? ' · quick bonus' : '' } · +${ pay } ✦` );

		}

	}

	// Places worth finding, for the compass and the map
	get places() {

		const list = [ { name: 'Harbour', icon: '⚓', color: '#ffd08a', x: 0, z: 0 } ];
		if ( this.save.data.ownsGalleon || this.save.data.foundGalleon ) {

			const g = this.galleon.position;
			list.push( { name: 'Galleon', icon: '⛵', color: '#ffb070', x: g.x, z: g.z } );

		}
		for ( const [ key, icon, color ] of [ [ 'flare', '☀', '#ff8a3a' ], [ 'rings', '❄', '#8ee8ff' ], [ 'rim', '◉', '#c08aff' ] ] ) {

			const r = REGIONS[ key ];
			list.push( { name: r.name.replace( /^the /, '' ).replace( /^./, ( ch ) => ch.toUpperCase() ), icon, color, x: r.x, z: r.z, radius: r.radius } );

		}
		return list;

	}

	// the compass strip (always) and the sea chart (Tab)
	updateNavigation() {

		const f = this.camera.getWorldDirection( this._nav || ( this._nav = new THREE.Vector3() ) );
		const heading = ( Math.atan2( f.x, - f.z ) * 180 / Math.PI + 360 ) % 360;
		const me = this.onFoot ? this.walker.position : this.mode === 'helm' ? this.galleon.position : this.surfer.position;
		const places = this.places;
		this.compass.update( heading, places, me );
		if ( this.seaMap.open ) {

			const pod = this.leviathans.whales[ 0 ].mesh.position;
			this.seaMap.draw( {
				regions: places.filter( ( p ) => p.radius ),
				places: places.filter( ( p ) => ! p.radius ),
				pod: { x: pod.x, z: pod.z },
				player: { x: me.x, z: me.z, heading }
			} );

		}

	}

	// top-of-screen objective: an arrow toward the target (relative to the camera), distance and time
	updateObjective() {

		const racing = this.race.state === 'running';
		const t = racing ? this.race.target : this.courier.target;
		if ( ! t ) {

			if ( this.objectiveShown ) this.objectiveEl.style.opacity = 0;
			this.objectiveShown = false;
			return;

		}
		const cam = this.camera.position, f = this.camera.getWorldDirection( this._fwd || ( this._fwd = new THREE.Vector3() ) );
		const dx = t.x - cam.x, dz = t.z - cam.z, d = Math.hypot( dx, dz );
		const ang = Math.atan2( f.x * dz - f.z * dx, f.x * dx + f.z * dz ) * 180 / Math.PI;
		// races count up (from the first gate), courier jobs count down
		const left = racing ? Infinity : Math.max( 0, Math.ceil( this.courier.timeLeft ) );
		const clock = racing ? formatTime( this.race.time ) : `${ Math.floor( left / 60 ) }:${ String( left % 60 ).padStart( 2, '0' ) }`;
		this.objectiveEl.querySelector( '.arrow' ).style.transform = `rotate( ${ ang.toFixed( 0 ) }deg )`;
		const text = `${ t.label } · ${ Math.round( d ) } m · ${ clock }`;
		if ( text !== this.objectiveText ) this.objectiveEl.querySelector( '.label' ).textContent = this.objectiveText = text;
		this.objectiveEl.classList.toggle( 'urgent', left <= 20 );
		if ( ! this.objectiveShown ) this.objectiveEl.style.opacity = 1;
		this.objectiveShown = true;

	}

	onLand( r ) {

		this.chase.land( r.impact );
		this.spray.burst( this.surfer, Math.min( 40, 6 + r.impact * 3 ) | 0 );
		const lost = this.combo.land( r );
		if ( r.kind === 'wipeout' ) {

			this.showCombo( lost ? 'bail' : null );
			return this.toast( r.bail === 'flip' ? 'Bail! Landed mid-flip' : 'Wipeout!' );

		}
		if ( r.spin >= 180 ) this.save.stat( 'tricks', ( n ) => n + 1 );
		this.save.stat( 'bestAir', ( b ) => Math.max( b, +r.air.toFixed( 2 ) ) );
		this.showCombo( r.kind === 'sketchy' && this.combo.active ? 'sketchy' : null );

	}

	// grinds (game/Grinds.js): hold L in the air near a rail to lock on; A/D balance; Space pops off
	updateGrind( dt, input, key ) {

		const s = this.surfer, G = this.grinds;
		// L must be let go between grinds (holding it re-locked at a rail's end, over and over)
		if ( ! input.down( 'KeyL' ) ) this.grindLatch = false;
		if ( ! G.state && ! this.grindLatch && input.down( 'KeyL' ) && G.tryStart( s ) ) {

			s.grinding = true;
			this.combo.hold();

		}
		if ( G.state ) {

			const r = G.update( dt, s, key( 'KeyD' ) - key( 'KeyA' ), input.wasPressed( 'Space' ) );
			if ( r ) {

				s.grinding = false;
				s.grounded = false;
				this.grindLatch = true;
				s.takeOff();
				if ( r.end === 'bail' ) {

					s.wipeout = BOARD.wipeoutTime;
					const lost = this.combo.land( { kind: 'wipeout' } );
					this.showCombo( lost ? 'bail' : null );
					this.toast( 'Bail! Off the rail' );

				} else if ( r.time >= GRIND.minTime ) {

					this.combo.add( `${ r.name } Grind`, GRIND.points + r.time * GRIND.perSecond );
					this.showCombo();

				}

			}

		}
		// the balance meter while grinding
		if ( this.balanceEl ) {

			this.balanceEl.className = G.state ? 'on' : '';
			if ( G.state ) this.balanceEl.firstElementChild.style.left = `${ ( 50 + Math.max( - 1, Math.min( 1, G.balance ) ) * 50 ).toFixed( 1 ) }%`;

		}

	}

	// per frame: the combo banks when its link runs out (riding a bow wave or flare-front keeps it going)
	updateCombo( dt ) {

		if ( this.bowGrace > 0 || this.flareGrace > 0 ) this.combo.sustain();
		const wasLive = this.combo.active;
		const banked = this.combo.update( dt, this.surfer.grounded );
		if ( banked > 0 ) {

			const got = this.earn( Math.max( 1, Math.round( banked / TRICK.creditsPer ) ) );
			this.save.stat( 'bestCombo', ( b ) => Math.max( b || 0, banked ) );
			this.showCombo( 'banked', banked, got );

		} else if ( wasLive && this.combo.active ) this.showCombo();

	}

	// the THPS-style combo readout: the trick chain, then the score x multiplier
	showCombo( state = null, banked = 0, credits = 0 ) {

		const el = this.comboEl, c = this.combo;
		if ( ! el ) return;
		clearTimeout( this.comboFade );
		if ( state === 'bail' ) {

			el.className = 'bail';
			el.innerHTML = '<div class="total">Bail!</div>';

		} else if ( state === 'banked' ) {

			el.className = 'banked';
			el.innerHTML = `<div class="total">${ banked.toLocaleString() }</div><div class="chain">+${ credits } ✦${ this.reachTag }</div>`;

		} else if ( c.active ) {

			const link = c.linkLeft === Infinity ? 1 : Math.max( 0, c.linkLeft / TRICK.link );
			el.className = 'live' + ( state === 'sketchy' ? ' sketchy' : '' );
			// the latest tricks only (a long chain would fill the screen)
			const shown = c.tricks.slice( - 6 ).map( ( t ) => t.name ).join( ' + ' );
			el.innerHTML = `<div class="chain">${ c.tricks.length > 6 ? '… + ' : '' }${ shown }</div>`
				+ `<div class="total">${ Math.round( c.base ).toLocaleString() } <span>× ${ c.multiplier }</span></div>`
				+ `<div class="link"><i style="width:${ ( link * 100 ).toFixed( 0 ) }%"></i></div>`;
			return;

		} else return;
		this.comboFade = setTimeout( () => ( el.className = '' ), 1800 );

	}

	// Credits from riding and tricks: doubled inside the Flare Reach. Returns what was paid.
	earn( n ) {

		const got = Math.round( n * this.regions.multiplier );
		this.save.addCredits( got );
		return got;

	}

	get reachTag() {

		return this.regions.inReach ? ` (×${ this.regions.multiplier })` : '';

	}

	onSunstone( pos ) {

		const got = this.earn( REACH.sunstone );
		this.save.stat( 'sunstones', ( n ) => n + 1 );
		this.spray.burst( { position: pos, velocity: this.surfer.velocity }, 14 );
		this.toast( `Sunstone! · +${ got } ✦${ this.reachTag }` );

	}

	onStardust( pos, trailDone ) {

		const pay = REWARDS.stardust + ( trailDone ? REWARDS.trailBonus : 0 );
		this.save.addCredits( pay );
		this.save.stat( 'stardust', ( n ) => n + 1 );
		this.spray.burst( { position: pos, velocity: this.surfer.velocity }, 6 );
		if ( trailDone ) this.toast( `Trail complete · +${ pay } ✦` );

	}

	showCredits( n ) {

		this.creditsEl.textContent = `✦ ${ n }`;
		this.creditsEl.classList.remove( 'pop' );
		void this.creditsEl.offsetWidth; // restart the pop animation
		this.creditsEl.classList.add( 'pop' );

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
		const G = this.galleon;
		const text = this.mode === 'helm' ? `${ this.hudHint }  ·  ${ G.speed.toFixed( 0 ) } m/s  ·  sails ${ '▰'.repeat( Math.round( G.sail * 5 ) ) }${ '▱'.repeat( 5 - Math.round( G.sail * 5 ) ) } ${ Math.round( G.sail * 100 ) }%${ G.sailState.name ? `  ·  ${ G.solarOnly ? 'solar drive' : G.sailState.name }` : '' }` : this.onFoot ? this.hudHint : `${ this.hudHint }  ·  ${ s.speed.toFixed( 0 ) } m/s${ s.grounded ? '' : ' · air' }${ power }${ this.regions.inReach ? `  ·  ${ this.regions.active.name.replace( 'the ', '' ) }: credits ×${ this.regions.multiplier }` : '' }`;
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

	// The whole frame's GPU cost (scene pass plus post) at the window's size: ms per pipeline.render().
	// Compare with URL flags (?noTAA, ...) to price a feature. __ew.benchmarkFrame()
	async benchmarkFrame( n = 40 ) {

		// each frame waits for the GPU (a queued batch returns before the work is done); stop the loop first
		const device = this.renderer.backend.device;
		this.renderer.setAnimationLoop( null );
		this.pipeline.render();
		await device.queue.onSubmittedWorkDone();
		const t0 = performance.now();
		for ( let i = 0; i < n; i ++ ) {

			this.sea.update( this.time += 1 / 60, this.camera );
			this.seaHeight?.update( this.camera );
			this.pipeline.render();
			await device.queue.onSubmittedWorkDone();

		}
		const ms = ( performance.now() - t0 ) / n;
		this.renderer.setAnimationLoop( ( t ) => this.frame( t ) );
		return ms;

	}

	updateStats() {

		const S = this.stats, now = performance.now();
		S.frames ++;
		S.worst = Math.max( S.worst, now - S.last );
		S.last = now;
		if ( now - S.since < 1000 ) return;
		const c = this.renderer.domElement;
		this.statsEl.textContent = `${ Math.round( S.frames * 1000 / ( now - S.since ) ) } fps · worst ${ S.worst.toFixed( 0 ) } ms · ${ c.width }x${ c.height } @${ devicePixelRatio } · ${ S.gpu }`;
		S.frames = 0;
		S.worst = 0;
		S.since = now;

	}

	// Reflections: the game's own sky (nebula cliffs, gas giant glow, the sun) rendered once into a cube
	// map and used as the scene's environment, so brass, the board and the hull reflect the real space
	// sky instead of nothing (renderer state saved and restored around it). ?noReflections to compare.
	buildEnvironment() {

		const sky = new THREE.Scene();
		sky.backgroundNode = this.scene.backgroundNode;
		const target = new THREE.CubeRenderTarget( 256, { type: THREE.HalfFloatType } );
		const cam = new THREE.CubeCamera( 1, 100, target );
		const state = THREE.RendererUtils.resetRendererState( this.renderer );
		cam.update( this.renderer, sky );
		THREE.RendererUtils.restoreRendererState( this.renderer, state );
		this.scene.environment = target.texture;
		this.scene.environmentIntensity = 0.8;

	}

	sizeBeauty() {

		if ( ! this.beauty ) return;
		const s = this.renderer.getDrawingBufferSize( new THREE.Vector2() );
		this.beauty.setSize( s.x, s.y );

	}

	onResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

}
