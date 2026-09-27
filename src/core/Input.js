// Keyboard + pointer-lock mouse state. Systems poll it each frame.
// Automated playtests can drive it directly: __ew.input.keys.add( 'KeyW' ).
export class Input {

	constructor( element ) {

		this.element = element;
		this.keys = new Set();
		this.mouseDX = 0;
		this.mouseDY = 0;

		window.addEventListener( 'keydown', ( e ) => this.keys.add( e.code ) );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.keys.clear() );

		element.addEventListener( 'click', () => {

			if ( document.pointerLockElement !== element ) element.requestPointerLock?.();

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

	// mouse movement since the last call
	consumeMouse() {

		const d = { x: this.mouseDX, y: this.mouseDY };
		this.mouseDX = this.mouseDY = 0;
		return d;

	}

}
