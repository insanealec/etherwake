// Dialogue box: a speaker name and one line at a time. open() starts a conversation, next() advances
// (and closes after the last line). With `choices`, the last line stays open and lists them
// ("E · accept   Q · not now"); choose( key ) picks one. The DOM lives in index.html (#dialogue).
export class Dialogue {

	constructor() {

		this.el = document.getElementById( 'dialogue' );
		this.nameEl = this.el.querySelector( '.name' );
		this.textEl = this.el.querySelector( '.text' );
		this.choicesEl = this.el.querySelector( '.choices' );
		this.active = false;

	}

	// choices: [ { key: 'KeyE', label: 'E · accept', action: fn }, ... ]
	open( name, lines, choices = null ) {

		this.lines = lines;
		this.choices = choices;
		this.index = 0;
		this.active = true;
		this.nameEl.textContent = name;
		this.show();
		this.el.classList.add( 'open' );

	}

	// on the last line of a conversation that has choices
	get atChoice() {

		return this.active && this.choices && this.index === this.lines.length - 1;

	}

	next() {

		if ( this.atChoice ) return;
		this.index ++;
		if ( this.index >= this.lines.length ) this.close();
		else this.show();

	}

	// returns true if `key` matched a choice (the conversation then closes)
	choose( key ) {

		const c = this.atChoice && this.choices.find( ( ch ) => ch.key === key );
		if ( ! c ) return false;
		this.close();
		if ( c.action ) c.action();
		return true;

	}

	show() {

		const last = this.index === this.lines.length - 1;
		this.textEl.textContent = this.lines[ this.index ] + ( last ? '' : '  ▸' );
		this.choicesEl.textContent = last && this.choices ? this.choices.map( ( c ) => c.label ).join( '     ' ) : '';

	}

	close() {

		this.active = false;
		this.el.classList.remove( 'open' );

	}

}
