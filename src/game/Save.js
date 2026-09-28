// Progress saved in localStorage. Storage can be unavailable (private windows, blocked site data),
// so every access is wrapped and the game runs fine without it.
const KEY = 'etherwake.save.v1';

const DEFAULTS = { credits: 0, stats: { stardust: 0, tricks: 0, bestAir: 0 } };

export class Save {

	constructor() {

		this.data = structuredClone( DEFAULTS );
		try {

			const raw = localStorage.getItem( KEY );
			if ( raw ) this.data = { ...this.data, ...JSON.parse( raw ) };

		} catch ( e ) {

			console.warn( '[etherwake] could not load save', e );

		}
		this.listeners = [];
		window.addEventListener( 'beforeunload', () => this.flush() );

	}

	get credits() {

		return this.data.credits;

	}

	addCredits( n ) {

		if ( ! n ) return;
		this.data.credits += n;
		this.changed();

	}

	stat( key, fn ) {

		this.data.stats[ key ] = fn( this.data.stats[ key ] ?? 0 );
		this.changed();

	}

	onChange( fn ) {

		this.listeners.push( fn );
		fn( this.data );

	}

	changed() {

		for ( const fn of this.listeners ) fn( this.data );
		clearTimeout( this.timer );
		this.timer = setTimeout( () => this.flush(), 1000 );

	}

	flush() {

		try {

			localStorage.setItem( KEY, JSON.stringify( this.data ) );

		} catch ( e ) { /* storage unavailable: progress lasts for this session only */ }

	}

	reset() {

		this.data = structuredClone( DEFAULTS );
		this.changed();
		this.flush();

	}

}
