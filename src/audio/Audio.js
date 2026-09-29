// Audio (WebAudio). Safety first: loud test audio has hurt the user before.
// - `?noAudio`, or localStorage 'etherwake.noAudio' = '1', disables audio entirely (automated runs use it).
// - The AudioContext only starts on a real (trusted) key press or click, so scripted input can't start it.
// - Modest master volume; M toggles mute (remembered); master volume is in the tweak panel.
const MUTE_KEY = 'etherwake.muted';

export const AUDIO = { volume: 0.35 };

function stored( key ) {

	try {

		return localStorage.getItem( key );

	} catch ( e ) {

		return null;

	}

}

export class Audio {

	constructor( params ) {

		this.disabled = params.has( 'noAudio' ) || stored( 'etherwake.noAudio' ) === '1';
		this.muted = stored( MUTE_KEY ) === '1';
		this.ctx = null;
		this.onStart = [];
		if ( this.disabled ) {

			console.info( '[etherwake] audio disabled' );
			return;

		}

		const start = ( e ) => {

			if ( ! e.isTrusted || this.ctx ) return;
			this.start();

		};
		window.addEventListener( 'keydown', start );
		window.addEventListener( 'pointerdown', start );
		window.addEventListener( 'keydown', ( e ) => {

			if ( e.code === 'KeyM' && ! e.repeat && e.isTrusted ) this.setMuted( ! this.muted );

		} );

	}

	start() {

		const ctx = this.ctx = new AudioContext();
		this.master = ctx.createGain();
		this.master.gain.value = this.muted ? 0 : AUDIO.volume;
		const limiter = ctx.createDynamicsCompressor(); // guards against sudden peaks
		limiter.threshold.value = - 12;
		limiter.ratio.value = 12;
		this.master.connect( limiter ).connect( ctx.destination );

		// a long, soft hall reverb from a generated impulse response
		this.reverb = ctx.createConvolver();
		const len = ctx.sampleRate * 5, ir = ctx.createBuffer( 2, len, ctx.sampleRate );
		for ( let c = 0; c < 2; c ++ ) {

			const d = ir.getChannelData( c );
			for ( let i = 0; i < len; i ++ ) d[ i ] = ( Math.random() * 2 - 1 ) * Math.pow( 1 - i / len, 3 );

		}
		this.reverb.buffer = ir;
		this.reverbIn = ctx.createGain();
		this.reverbIn.gain.value = 0.6;
		this.reverbIn.connect( this.reverb ).connect( this.master );

		console.info( '[etherwake] audio started' );
		for ( const fn of this.onStart ) fn( ctx );

	}

	get running() {

		return !! this.ctx && ! this.disabled;

	}

	setMuted( m ) {

		this.muted = m;
		try {

			localStorage.setItem( MUTE_KEY, m ? '1' : '0' );

		} catch ( e ) { /* not remembered */ }
		if ( this.master ) this.master.gain.setTargetAtTime( m ? 0 : AUDIO.volume, this.ctx.currentTime, 0.1 );

	}

	setVolume( v ) {

		AUDIO.volume = v;
		if ( this.master && ! this.muted ) this.master.gain.setTargetAtTime( v, this.ctx.currentTime, 0.1 );

	}

	// the listener follows the camera
	update( camera ) {

		if ( ! this.running ) return;
		const l = this.ctx.listener, p = camera.position, t = this.ctx.currentTime;
		const f = camera.getWorldDirection( this._f || ( this._f = camera.position.clone() ) );
		if ( l.positionX ) {

			l.positionX.setTargetAtTime( p.x, t, 0.05 );
			l.positionY.setTargetAtTime( p.y, t, 0.05 );
			l.positionZ.setTargetAtTime( p.z, t, 0.05 );
			l.forwardX.setTargetAtTime( f.x, t, 0.05 );
			l.forwardY.setTargetAtTime( f.y, t, 0.05 );
			l.forwardZ.setTargetAtTime( f.z, t, 0.05 );

		} else {

			l.setPosition( p.x, p.y, p.z );
			l.setOrientation( f.x, f.y, f.z, 0, 1, 0 );

		}

	}

}
