import { App } from './App.js';

const app = new App( document.body );
app.start().catch( ( err ) => {

	console.error( err );
	document.getElementById( 'hud' ).textContent = 'Failed to start: ' + err.message;

} );

// debug handle for the browser console / automated playtests
window.__ew = app;
