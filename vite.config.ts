import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5173
	},
	optimizeDeps: {
		include: ['leaflet', 'cytoscape']
	},
	define: {
		// Helps with Node.js compatibility issues
		global: 'globalThis'
	}
});