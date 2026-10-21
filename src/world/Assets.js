import * as THREE from 'three/webgpu';
import { texture, normalMap, vec2 } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Third-party assets (graphics pass 3, slice 6; all CC0 from Poly Haven, see CREDITS.md), loaded once
// at startup before the world is built: systems read ASSETS synchronously. A missing file only logs a
// warning and the system falls back to its procedural look.
export const ASSETS = { textures: {}, lantern: null };

const BASE = import.meta.env.BASE_URL + 'assets/';

// lantern: false skips the lantern model (low quality: the lanterns are just glows)
export async function loadAssets( { lantern = true } = {} ) {

	const loader = new THREE.TextureLoader();
	const load = ( file, srgb = false ) => loader.loadAsync( BASE + 'textures/' + file ).then( ( t ) => {

		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.anisotropy = 8;
		if ( srgb ) t.colorSpace = THREE.SRGBColorSpace;
		return t;

	} );
	const jobs = [];
	for ( const [ key, name ] of [ [ 'planks', 'weathered_brown_planks' ], [ 'deck', 'dark_wooden_planks' ] ] ) {

		jobs.push( Promise.all( [ load( `${ name }_diff_1k.jpg`, true ), load( `${ name }_nor_gl_1k.jpg` ), load( `${ name }_arm_1k.jpg` ) ] )
			.then( ( [ diff, nor, arm ] ) => ( ASSETS.textures[ key ] = { diff, nor, arm } ) ) );

	}
	jobs.push( Promise.all( [ load( 'rough_linen_nor_gl_1k.jpg' ), load( 'rough_linen_arm_1k.jpg' ) ] )
		.then( ( [ nor, arm ] ) => ( ASSETS.textures.linen = { nor, arm } ) ) );
	if ( lantern ) jobs.push( new GLTFLoader().loadAsync( BASE + 'models/lantern/Lantern_01_1k.gltf' ).then( ( g ) => ( ASSETS.lantern = g.scene ) ) );
	await Promise.all( jobs.map( ( j ) => j.catch( ( e ) => console.warn( '[etherwake] asset failed to load', e ) ) ) );

}

// PBR wood on a node material from a texture set ( diff, nor, arm ) at uv (a vec2 node, in tiles).
// tint: an optional vec3 node multiplied into the colour. Returns false if the set didn't load.
export function applyWood( mat, set, uvNode, tint = null ) {

	const T = ASSETS.textures[ set ];
	if ( ! T ) return false;
	const col = texture( T.diff, uvNode ).rgb;
	mat.colorNode = tint ? col.mul( tint ) : col;
	mat.normalNode = normalMap( texture( T.nor, uvNode ), vec2( 1, 1 ) );
	const arm = texture( T.arm, uvNode );
	mat.roughnessNode = arm.g;
	mat.aoNode = arm.r;
	return true;

}

// A lantern model scaled to `height` metres, standing on its base at the origin (a fresh clone).
export function lantern( height = 0.6 ) {

	if ( ! ASSETS.lantern ) return null;
	const model = ASSETS.lantern.clone( true );
	const box = new THREE.Box3().setFromObject( model );
	const size = box.getSize( new THREE.Vector3() );
	const s = height / size.y;
	model.scale.setScalar( s );
	model.position.set( - ( box.min.x + size.x / 2 ) * s, - box.min.y * s, - ( box.min.z + size.z / 2 ) * s );
	const holder = new THREE.Group();
	holder.add( model );
	return holder;

}
