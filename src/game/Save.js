// Progress saved in localStorage. Storage can be unavailable (private windows, blocked site data),
// so every access is wrapped and the game runs fine without it.
// - Several tabs of the game share one save: when another tab saves, this one adopts that newer save
//   (onExternal listeners re-apply upgrades), instead of overwriting it later with stale data.
// - Automated tests must call useSlot( 'test' ) first: a throwaway slot for this page session only, so
//   the player's real save is never read or written by a test (a reload returns to the real slot).
const KEY = 'etherwake.save.v1';

const DEFAULTS = { credits: 0, upgrades: {}, races: {}, stats: { stardust: 0, tricks: 0, bestAir: 0 } };

export class Save {

	constructor() {

		this.key = KEY;
		this.listeners = [];
		this.externalListeners = [];
		this.data = this.load();
		window.addEventListener( 'beforeunload', () => this.flush() );
		window.addEventListener( 'storage', ( e ) => {

			if ( e.key !== this.key || ! e.newValue ) return;
			this.data = this.load();
			for ( const fn of this.listeners ) fn( this.data );
			for ( const fn of this.externalListeners ) fn( this.data );

		} );

	}

	load() {

		const data = structuredClone( DEFAULTS );
		try {

			const raw = localStorage.getItem( this.key );
			if ( raw ) return { ...data, ...JSON.parse( raw ) };

		} catch ( e ) {

			console.warn( '[etherwake] could not load save', e );

		}
		return data;

	}

	// Switch to a separate save slot for the rest of this page session (tests: useSlot( 'test' )).
	useSlot( name ) {

		clearTimeout( this.timer ); // don't let a pending write land in the new slot
		this.key = `${ KEY }.${ name }`;
		this.data = this.load();
		for ( const fn of this.listeners ) fn( this.data );
		for ( const fn of this.externalListeners ) fn( this.data );
		console.info( `[etherwake] save slot: ${ this.key }` );

	}

	get credits() {

		return this.data.credits;

	}

	addCredits( n ) {

		if ( ! n ) return;
		this.data.credits += n;
		this.changed();

	}

	// spend credits if there are enough; returns whether it happened
	spend( n ) {

		if ( this.data.credits < n ) return false;
		this.data.credits -= n;
		this.changed();
		return true;

	}

	level( id ) {

		return this.data.upgrades[ id ] || 0;

	}

	setLevel( id, level ) {

		this.data.upgrades[ id ] = level;
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

	// called when the save is replaced from outside (another tab saved, or a slot switch)
	onExternal( fn ) {

		this.externalListeners.push( fn );

	}

	changed() {

		for ( const fn of this.listeners ) fn( this.data );
		clearTimeout( this.timer );
		this.timer = setTimeout( () => this.flush(), 1000 );

	}

	flush() {

		try {

			localStorage.setItem( this.key, JSON.stringify( this.data ) );

		} catch ( e ) { /* storage unavailable: progress lasts for this session only */ }

	}

	reset() {

		this.data = structuredClone( DEFAULTS );
		this.changed();
		this.flush();

	}

}
