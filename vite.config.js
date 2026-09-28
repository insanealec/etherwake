import { defineConfig } from 'vite';

export default defineConfig( {
	base: './',
	build: { target: 'es2022' },
	// PORT lets the preview tool assign a free port; 5190 otherwise
	server: { host: '127.0.0.1', port: Number( process.env.PORT ) || 5190 },
	preview: { host: '127.0.0.1', port: Number( process.env.PORT ) || 5190 },
} );
