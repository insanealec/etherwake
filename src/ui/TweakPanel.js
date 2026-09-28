import GUI from 'lil-gui';
import { SEA, WAVES } from '../sea/Waves.js';
import { PALETTE, FOG } from '../sea/Etherium.js';
import { BOARD } from '../game/Gear.js';
import { WIND } from '../world/Wind.js';

// Debug tweak panel (lil-gui). H toggles it; hidden by default, `?tweaks` opens it on load.
// Edits the data tables in place; wave edits call sea.refresh() to re-upload uniforms.
// Changes are not saved: copy good numbers back into Waves.js / Etherium.js by hand.
export class TweakPanel {

	constructor( app ) {

		const sea = app.sea;
		const refresh = () => sea.refresh();
		const gui = this.gui = new GUI( { title: 'Etherium (H)' } );

		const swell = gui.addFolder( 'Swell' );
		swell.add( SEA, 'height', 0, 3, 0.01 ).name( 'height ×' ).onChange( refresh );
		swell.add( SEA, 'steepness', 0, 1.3, 0.01 ).name( 'steepness ×' ).onChange( refresh );
		swell.add( SEA, 'gravity', 0.5, 20, 0.1 ).name( 'gravity (speed)' ).onChange( refresh );
		swell.add( SEA, 'fadeStart', 1, 60, 1 ).name( 'fade start (λ)' ).onChange( refresh );
		swell.add( SEA, 'fadeEnd', 2, 120, 1 ).name( 'fade end (λ)' ).onChange( refresh );

		const waves = gui.addFolder( 'Waves' ).close();
		WAVES.forEach( ( w, i ) => {

			const f = waves.addFolder( `Wave ${ i + 1 }` ).close();
			f.add( w, 'wavelength', 2, 400, 0.5 ).onChange( refresh );
			f.add( w, 'steepness', 0, 0.5, 0.005 ).onChange( refresh );
			f.add( w, 'angle', - 180, 180, 1 ).onChange( refresh );
			f.add( w, 'speed', 0, 3, 0.01 ).onChange( refresh );

		} );

		// pickers show sRGB hex; Color.set / getHexString convert to and from the linear PALETTE values
		const colors = gui.addFolder( 'Colours' ).close();
		const hex = {};
		for ( const key of Object.keys( PALETTE ) ) {

			hex[ key ] = '#' + PALETTE[ key ].getHexString();
			colors.addColor( hex, key ).onChange( ( v ) => PALETTE[ key ].set( v ) );

		}

		const fog = gui.addFolder( 'Fog' ).close();
		fog.add( FOG, 'above', 0, 0.005, 0.0001 ).name( 'density above' );
		fog.add( FOG, 'below', 0, 0.1, 0.001 ).name( 'density below' );

		const board = gui.addFolder( 'Board' ).close();
		const ranges = {
			gravity: [ 2, 30 ], airGravity: [ 2, 30 ], slope: [ 0, 3 ], slopeUp: [ 0, 3 ], thrust: [ 0, 15 ], pump: [ 0, 8 ], brake: [ 0, 5 ], drag: [ 0, 0.5 ], dragQuad: [ 0, 0.05 ],
			grip: [ 0, 20 ], turnRate: [ 0.2, 4 ], turnMinSpeed: [ 0, 20 ], jump: [ 0, 20 ], pop: [ 0, 3 ], maxLaunch: [ 5, 40 ], airTurn: [ 0, 8 ], liftOff: [ 0, 1 ],
			cleanAngle: [ 0, 90 ], wipeoutAngle: [ 0, 180 ], sketchyKeep: [ 0, 1 ], wipeoutTime: [ 0.2, 4 ]
		};
		for ( const key of Object.keys( BOARD ) ) board.add( BOARD, key, ...( ranges[ key ] || [] ) );

		const wind = gui.addFolder( 'Wind' ).close();
		wind.add( WIND, 'angle', - 180, 180, 1 ).name( 'angle (0 = +x)' );
		wind.add( WIND, 'strength', 0, 3, 0.01 );

		const linear = () => Object.fromEntries( Object.entries( PALETTE ).map( ( [ k, c ] ) => [ k, c.toArray().map( ( x ) => + x.toFixed( 3 ) ) ] ) );
		gui.add( { log: () => console.log( JSON.stringify( { SEA, WAVES, FOG, BOARD, WIND, PALETTE: linear() }, null, '\t' ) ) }, 'log' ).name( 'log values to console' );

		gui.show( app.params.has( 'tweaks' ) );
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'KeyH' && ! e.repeat ) gui.show( gui._hidden );

		} );

	}

}
