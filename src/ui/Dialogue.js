// Dialogue box: a speaker name and one line at a time. open() starts a conversation, next() advances
// (and closes after the last line). The DOM lives in index.html (#dialogue).
export class Dialogue {

	constructor() {

		this.el = document.getElementById( 'dialogue' );
		this.nameEl = this.el.querySelector( '.name' );
		this.textEl = this.el.querySelector( '.text' );
		this.active = false;

	}

	open( name, lines ) {

		this.lines = lines;
		this.index = 0;
		this.active = true;
		this.nameEl.textContent = name;
		this.show();
		this.el.classList.add( 'open' );

	}

	next() {

		this.index ++;
		if ( this.index >= this.lines.length ) this.close();
		else this.show();

	}

	show() {

		const more = this.index < this.lines.length - 1;
		this.textEl.textContent = this.lines[ this.index ] + ( more ? '  ▸' : '' );

	}

	close() {

		this.active = false;
		this.el.classList.remove( 'open' );

	}

}
