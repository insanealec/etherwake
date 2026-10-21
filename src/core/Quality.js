// Graphics quality levels. Picked automatically (phones and tablets get 'low', desktops 'high'),
// overridden by ?quality=low|medium|high or by the setting on the title screen (remembered on this
// device). The old ?noX flags still turn single features off on top of any level.
// pixelRatio: the most device pixels per CSS pixel rendered; minScale: how far dynamic resolution may
// lower that when frames run slow. simpleSea: the cheap sea shading; skyCube: the procedural sky rendered
// into a cube map of this size (0: drawn live, every pixel every frame).
export const QUALITY = {
	high: {
		pixelRatio: 2, minScale: 0.6, taa: true, volume: true, volumeRes: 1, puffs: true, bloom: true,
		godRays: true, autoExposure: true, reflections: true, motes: [ 'wide', 'near' ], seaSegments: 512, lanterns: true,
		simpleSea: false, skyCube: 0
	},
	medium: {
		pixelRatio: 1.5, minScale: 0.5, taa: true, volume: true, volumeRes: 0.6, puffs: false, bloom: true,
		godRays: false, autoExposure: true, reflections: true, motes: [ 'near' ], seaSegments: 384, lanterns: true,
		simpleSea: false, skyCube: 768
	},
	low: {
		pixelRatio: 1, minScale: 0.5, taa: false, volume: false, volumeRes: 0.5, puffs: false, bloom: false,
		godRays: false, autoExposure: false, reflections: false, motes: [ 'near' ], seaSegments: 256, lanterns: false,
		simpleSea: true, skyCube: 512
	}
};

export const LEVELS = [ 'auto', 'high', 'medium', 'low' ];
const KEY = 'etherwake.quality';

export const isMobile = () => matchMedia( '( pointer: coarse )' ).matches || /Android|iPhone|iPad|Mobile/i.test( navigator.userAgent );

// the level to use: { name, chosen ('auto' or the forced level), ...preset }
export function pickQuality( params ) {

	let chosen = params.get( 'quality' );
	if ( ! QUALITY[ chosen ] ) {

		try {

			chosen = localStorage.getItem( KEY ) || 'auto';

		} catch ( e ) {

			chosen = 'auto';

		}

	}
	const name = QUALITY[ chosen ] ? chosen : ( isMobile() ? 'low' : 'high' );
	return { name, chosen: QUALITY[ chosen ] ? chosen : 'auto', ...QUALITY[ name ] };

}

// remember a level on this device ('auto' clears it)
export function saveQuality( level ) {

	try {

		if ( level === 'auto' ) localStorage.removeItem( KEY );
		else localStorage.setItem( KEY, level );

	} catch ( e ) { /* not remembered */ }

}

// Dynamic resolution: if frames run slow the render scale steps down (to minScale), and creeps back up
// when there's headroom. Frame times are smoothed; a change happens at most once a second.
export class DynamicResolution {

	constructor( q ) {

		this.min = q.minScale;
		this.scale = 1;
		this.avg = 1 / 60;
		this.wait = 2; // let the first frames (shader compiles) settle
		this.good = 0;

	}

	// dt: the frame's real duration (s). Returns true when the scale changed.
	update( dt ) {

		if ( document.hidden || ! ( dt > 0 ) || dt > 0.5 ) return false;
		this.avg += ( dt - this.avg ) * 0.1;
		this.wait -= dt;
		if ( this.wait > 0 ) return false;
		if ( this.avg > 1 / 48 && this.scale > this.min ) {

			this.scale = Math.max( this.min, this.scale * 0.85 );
			this.wait = 1;
			this.good = 0;
			return true;

		}
		this.good = this.avg < 1 / 57 ? this.good + dt : 0;
		if ( this.good > 3 && this.scale < 1 ) {

			this.scale = Math.min( 1, this.scale * 1.1 );
			this.wait = 1;
			this.good = 0;
			return true;

		}
		return false;

	}

}
