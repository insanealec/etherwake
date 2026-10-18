// The title screen: the game's name over the live scene (App circles the camera round the harbour while
// it's open), a line to set sail or continue, the voyage so far and the controls. Any trusted click or
// key closes it, the same gesture that starts the audio. Skipped with ?noTitle and by __ew.testMode().
export const TITLE = {
	orbit: { radius: 85, height: 20, speed: 0.04, lookUp: 4 } // the camera's slow circle while it's open
};

export class Title {

	// save: the save data ({ credits, ownsGalleon, ... }); onClose: called once when it closes
	constructor( save, onClose ) {

		this.open = true;
		this.onClose = onClose;
		const fresh = ! save.credits && ! save.ownsGalleon && ! Object.keys( save.upgrades || {} ).length;
		const el = this.el = document.createElement( 'div' );
		el.id = 'title';
		el.innerHTML = `
			<div class="name">Etherwake</div>
			<div class="tag">surf the glowing etherium between the stars</div>
			<div class="go">${ fresh ? 'Click to set sail' : 'Click to continue your voyage' }</div>
			${ fresh ? '' : `<div class="voyage">✦ ${ save.credits || 0 } credits${ save.ownsGalleon ? ' · the galleon is yours' : '' }</div>` }
			<div class="keys">A/D carve · W sail · S brake · Space jump · J flip · K grab · L grind · E dock and talk · Tab sea chart · M mute</div>`;
		document.body.appendChild( el );
		document.body.classList.add( 'on-title' );

		this.listen = ( e ) => {

			if ( ! e.isTrusted || ( e.type === 'keydown' && [ 'Tab', 'F5', 'F12' ].includes( e.code ) ) ) return;
			this.close();

		};
		window.addEventListener( 'pointerdown', this.listen );
		window.addEventListener( 'keydown', this.listen );

	}

	close() {

		if ( ! this.open ) return;
		this.open = false;
		window.removeEventListener( 'pointerdown', this.listen );
		window.removeEventListener( 'keydown', this.listen );
		document.body.classList.remove( 'on-title' );
		this.el.classList.add( 'closing' );
		setTimeout( () => this.el.remove(), 900 );
		this.onClose?.();

	}

}
