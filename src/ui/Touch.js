// Touch controls (phones and tablets; ?touch forces them on): a thumb stick that appears wherever the left
// thumb lands, and buttons on the right. They drive the same key states as the keyboard (core/Input.js),
// so every system works unchanged: the stick is W/A/S/D (carve and sail, walking, and the direction of a
// trick), the buttons are Space (jump), J (flip), K (grab), L (grind) and E (act: dock, talk, helm),
// with small ones for the sea chart (Tab), the galleon (G) and mute (M). Dialogue choices become tappable.
// The first touch asks for fullscreen and a landscape lock (where the browser allows).
export const TOUCH = {
	deadZone: 0.3, // of the stick's reach, before a direction counts
	reach: 60 // px from the stick's centre to full deflection
};

const BUTTONS = [
	{ code: 'Space', label: 'Jump', cls: 'big' },
	{ code: 'KeyJ', label: 'Flip' },
	{ code: 'KeyK', label: 'Grab' },
	{ code: 'KeyL', label: 'Grind' },
	{ code: 'KeyE', label: 'Act' }
];
const SMALL = [
	{ code: 'Tab', label: 'Map' },
	{ code: 'KeyG', label: 'Ship' },
	{ code: 'KeyM', label: 'Mute' }
];

export class Touch {

	// onMute: called by the Mute button (the audio toggles on a real key press, not a key state)
	constructor( input, { onMute } = {} ) {

		this.input = input;
		document.body.classList.add( 'touch' );
		const el = this.el = document.createElement( 'div' );
		el.id = 'touch';
		el.innerHTML = `<div class="stick"><i></i></div>
			<div class="buttons">${ BUTTONS.map( ( b ) => `<button data-code="${ b.code }" class="${ b.cls || '' }">${ b.label }</button>` ).join( '' ) }</div>
			<div class="small">${ SMALL.map( ( b ) => `<button data-code="${ b.code }">${ b.label }</button>` ).join( '' ) }</div>`;
		document.body.appendChild( el );
		this.stick = el.querySelector( '.stick' );
		this.knob = this.stick.firstElementChild;
		this.stickId = null;

		// buttons: held while touched
		for ( const btn of el.querySelectorAll( 'button' ) ) {

			const code = btn.dataset.code;
			btn.addEventListener( 'pointerdown', ( e ) => {

				e.preventDefault();
				e.stopPropagation();
				try {

					btn.setPointerCapture( e.pointerId );

				} catch ( err ) { /* not a capturable pointer */ }
				this.goFullscreen();
				if ( code === 'KeyM' ) return onMute?.();
				input.keys.add( code );
				input.pressed.add( code );
				btn.classList.add( 'on' );

			} );
			const up = () => {

				input.keys.delete( code );
				btn.classList.remove( 'on' );

			};
			btn.addEventListener( 'pointerup', up );
			btn.addEventListener( 'pointercancel', up );

		}

		// the stick: the left half of the screen, anywhere
		window.addEventListener( 'pointerdown', ( e ) => {

			if ( e.pointerType !== 'touch' || this.stickId !== null || e.clientX > innerWidth * 0.5 ) return;
			if ( e.target.closest?.( 'button, #dialogue .choices span' ) ) return;
			this.stickId = e.pointerId;
			this.origin = { x: e.clientX, y: e.clientY };
			this.stick.style.left = `${ e.clientX }px`;
			this.stick.style.top = `${ e.clientY }px`;
			this.stick.classList.add( 'on' );
			this.move( e );
			this.goFullscreen();

		} );
		window.addEventListener( 'pointermove', ( e ) => {

			if ( e.pointerId === this.stickId ) this.move( e );

		} );
		const release = ( e ) => {

			if ( e.pointerId !== this.stickId ) return;
			this.stickId = null;
			this.stick.classList.remove( 'on' );
			for ( const k of [ 'KeyW', 'KeyA', 'KeyS', 'KeyD' ] ) input.keys.delete( k );

		};
		window.addEventListener( 'pointerup', release );
		window.addEventListener( 'pointercancel', release );

		// dialogue: tap a choice to pick it, tap the box to go on
		document.getElementById( 'dialogue' )?.addEventListener( 'pointerdown', ( e ) => {

			const choice = e.target.closest( '[data-key]' );
			input.pressed.add( choice ? choice.dataset.key : 'KeyE' );
			e.stopPropagation();

		} );

	}

	move( e ) {

		const T = TOUCH;
		let dx = ( e.clientX - this.origin.x ) / T.reach, dy = ( e.clientY - this.origin.y ) / T.reach;
		const len = Math.hypot( dx, dy );
		if ( len > 1 ) {

			dx /= len;
			dy /= len;

		}
		this.knob.style.transform = `translate( ${ dx * T.reach }px, ${ dy * T.reach }px )`;
		const set = ( code, on ) => on ? this.input.keys.add( code ) : this.input.keys.delete( code );
		set( 'KeyA', dx < - T.deadZone );
		set( 'KeyD', dx > T.deadZone );
		set( 'KeyW', dy < - T.deadZone );
		set( 'KeyS', dy > T.deadZone );

	}

	goFullscreen() {

		if ( this.triedFullscreen ) return;
		this.triedFullscreen = true;
		document.documentElement.requestFullscreen?.().then( () => screen.orientation?.lock?.( 'landscape' ) ).catch( () => {} );

	}

}
