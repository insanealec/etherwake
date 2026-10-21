// Keyboard + pointer-lock mouse state. Systems poll it each frame.
// Automated playtests can drive it directly: __ew.input.keys.add( 'KeyW' ).
export class Input {

	constructor( element ) {

		this.element = element;
		this.keys = new Set();
		this.pressed = new Set(); // keys that went down this frame
		this.stick = null; // { x, y } -1..1 while the touch stick is held (ui/Touch.js); x is analog steering
		this.mouseDX = 0;
		this.mouseDY = 0;

		window.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'Tab' ) e.preventDefault(); // the map, not focus changes
			this.keys.add( e.code );
			if ( ! e.repeat ) this.pressed.add( e.code );

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.keys.clear() );

		element.addEventListener( 'click', () => {

			if ( document.pointerLockElement !== element ) element.requestPointerLock?.()?.catch?.( () => {} ); // rejected in some embedded browsers

		} );
		document.addEventListener( 'mousemove', ( e ) => {

			if ( document.pointerLockElement !== element ) return;
			this.mouseDX += e.movementX;
			this.mouseDY += e.movementY;

		} );

	}

	down( code ) {

		return this.keys.has( code );

	}

	// true on the frame the key went down
	wasPressed( code ) {

		return this.pressed.has( code );

	}

	// simulate a key press for automated tests: __ew.input.tap( 'Space' )
	tap( code ) {

		this.pressed.add( code );

	}

	endFrame() {

		this.pressed.clear();

	}

	// mouse movement since the last call
	consumeMouse() {

		const d = { x: this.mouseDX, y: this.mouseDY };
		this.mouseDX = this.mouseDY = 0;
		return d;

	}

}
