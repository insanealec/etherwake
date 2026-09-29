// Leviathan song, synthesised with WebAudio: long, low calls gliding through a few pitches, with slow
// vibrato, a soft upper harmonic, a lowpass and a hall reverb. Each whale sings from its own position
// (a PannerNode, so it fades with distance and pans). The calf sings higher. Now and then another
// whale answers.
export const SONG = {
	gain: 0.22, // peak level of one call before distance and master volume
	gap: [ 7, 18 ], // seconds between a whale's calls
	answerChance: 0.5,
	audible: 2500 // metres: whales further away don't bother calling
};

const rand = ( a, b ) => a + Math.random() * ( b - a );

export class WhaleSong {

	constructor( audio, leviathans ) {

		this.audio = audio;
		this.whales = leviathans.whales;
		this.time = 0;
		for ( const w of this.whales ) w.nextCall = rand( 2, 10 );
		audio.onStart.push( ( ctx ) => this.setup( ctx ) );

	}

	setup( ctx ) {

		for ( const w of this.whales ) {

			const p = w.panner = ctx.createPanner();
			p.panningModel = 'equalpower';
			p.distanceModel = 'inverse';
			p.refDistance = 150;
			p.maxDistance = 4000;
			p.rolloffFactor = 1;
			p.connect( this.audio.master );
			p.connect( this.audio.reverbIn );

		}

	}

	call( w ) {

		const ctx = this.audio.ctx, t0 = ctx.currentTime + 0.05;
		const calf = w.length < 40;
		const base = calf ? rand( 260, 420 ) : rand( 65, 140 );
		const dur = rand( 2.5, 5.5 );

		// a few pitches to glide through
		const steps = [ 1 ];
		for ( let i = 0; i < 3; i ++ ) steps.push( Math.max( 0.6, Math.min( 1.8, steps[ i ] * rand( 0.75, 1.35 ) ) ) );

		const env = ctx.createGain();
		env.gain.setValueAtTime( 0, t0 );
		env.gain.setTargetAtTime( SONG.gain, t0, 0.35 );
		env.gain.setTargetAtTime( 0, t0 + dur, 0.5 );
		const lp = ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.value = calf ? 1400 : 700;
		lp.connect( env ).connect( w.panner );

		const vib = ctx.createOscillator();
		vib.frequency.value = rand( 3.5, 6 );
		const oscs = [ [ 'sine', 1, 1 ], [ 'triangle', 2, 0.22 ] ].map( ( [ type, mult, level ] ) => {

			const o = ctx.createOscillator();
			o.type = type;
			o.frequency.setValueAtTime( base * mult, t0 );
			steps.forEach( ( s, i ) => o.frequency.linearRampToValueAtTime( base * mult * s, t0 + dur * ( i + 1 ) / steps.length ) );
			const depth = ctx.createGain();
			depth.gain.value = base * mult * 0.015;
			vib.connect( depth ).connect( o.frequency );
			const g = ctx.createGain();
			g.gain.value = level;
			o.connect( g ).connect( lp );
			return o;

		} );

		const end = t0 + dur + 3;
		for ( const o of [ vib, ...oscs ] ) {

			o.start( t0 );
			o.stop( end );

		}

	}

	update( dt, listener ) {

		this.time += dt;
		if ( ! this.audio.running ) return;
		for ( const w of this.whales ) {

			const m = w.mesh.position;
			w.panner.positionX.value = m.x;
			w.panner.positionY.value = m.y;
			w.panner.positionZ.value = m.z;
			if ( this.time < w.nextCall ) continue;
			w.nextCall = this.time + rand( ...SONG.gap );
			if ( m.distanceTo( listener ) > SONG.audible ) continue;
			this.call( w );
			// sometimes another answers
			if ( Math.random() < SONG.answerChance ) {

				const other = this.whales[ ( this.whales.indexOf( w ) + 1 + ( Math.random() * ( this.whales.length - 1 ) | 0 ) ) % this.whales.length ];
				other.nextCall = Math.min( other.nextCall, this.time + rand( 2, 4 ) );

			}

		}

	}

}
