import * as THREE from 'three/webgpu';

// Tileable 3D cloud noise for the volumetric etherium (graphics pass 3), generated once at startup:
// R = Perlin-Worley (billowy base shapes), G = Worley fbm (detail that erodes the edges into wisps).
// The classic cumulus recipe (Schneider, "The real-time volumetric cloudscapes of Horizon Zero Dawn").
const fract = ( x ) => x - Math.floor( x );
const wrap = ( n, p ) => ( ( n % p ) + p ) % p;
const hash = ( i, j, k, s ) => fract( Math.sin( i * 127.1 + j * 311.7 + k * 74.7 + s * 19.3 ) * 43758.5453 );
const smooth = ( t ) => t * t * ( 3 - 2 * t );

// periodic value noise in [0, 1], period p (cells)
function valueNoise( x, y, z, p ) {

	const i = Math.floor( x ), j = Math.floor( y ), k = Math.floor( z );
	const fx = smooth( x - i ), fy = smooth( y - j ), fz = smooth( z - k );
	const v = ( a, b, c ) => hash( wrap( i + a, p ), wrap( j + b, p ), wrap( k + c, p ), 0 );
	const lerp = ( a, b, t ) => a + ( b - a ) * t;
	return lerp(
		lerp( lerp( v( 0, 0, 0 ), v( 1, 0, 0 ), fx ), lerp( v( 0, 1, 0 ), v( 1, 1, 0 ), fx ), fy ),
		lerp( lerp( v( 0, 0, 1 ), v( 1, 0, 1 ), fx ), lerp( v( 0, 1, 1 ), v( 1, 1, 1 ), fx ), fy ),
		fz
	);

}

// periodic Worley noise: distance to the nearest feature point (one per cell), clamped to [0, 1]
function worley( x, y, z, p ) {

	const i = Math.floor( x ), j = Math.floor( y ), k = Math.floor( z );
	let best = 9;
	for ( let a = - 1; a <= 1; a ++ ) for ( let b = - 1; b <= 1; b ++ ) for ( let c = - 1; c <= 1; c ++ ) {

		const ci = i + a, cj = j + b, ck = k + c;
		const wi = wrap( ci, p ), wj = wrap( cj, p ), wk = wrap( ck, p );
		const dx = ci + hash( wi, wj, wk, 1 ) - x, dy = cj + hash( wi, wj, wk, 2 ) - y, dz = ck + hash( wi, wj, wk, 3 ) - z;
		const d = dx * dx + dy * dy + dz * dz;
		if ( d < best ) best = d;

	}
	return Math.min( 1, Math.sqrt( best ) );

}

export function cloudNoiseTexture( N = 64 ) {

	const data = new Uint8Array( N * N * N * 4 );
	for ( let z = 0; z < N; z ++ ) for ( let y = 0; y < N; y ++ ) for ( let x = 0; x < N; x ++ ) {

		const u = x / N, v = y / N, w = z / N;
		let perlin = 0, amp = 0.5, norm = 0;
		for ( let o = 0, f = 4; o < 4; o ++, f *= 2, amp *= 0.5 ) {

			perlin += valueNoise( u * f, v * f, w * f, f ) * amp;
			norm += amp;

		}
		perlin /= norm;
		const wf = ( f ) => 1 - worley( u * f, v * f, w * f, f );
		const cells = wf( 4 ) * 0.625 + wf( 8 ) * 0.25 + wf( 16 ) * 0.125;
		const pw = Math.max( 0, Math.min( 1, ( perlin - ( cells - 1 ) ) / ( 2 - cells ) ) ); // remap(perlin, cells - 1, 1, 0, 1)
		const detail = wf( 8 ) * 0.5 + wf( 16 ) * 0.3 + wf( 32 ) * 0.2;
		const o = ( ( z * N + y ) * N + x ) * 4;
		data[ o ] = pw * 255;
		data[ o + 1 ] = detail * 255;
		data[ o + 3 ] = 255;

	}
	const tex = new THREE.Data3DTexture( data, N, N, N );
	tex.format = THREE.RGBAFormat;
	tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
	tex.minFilter = tex.magFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;

}
