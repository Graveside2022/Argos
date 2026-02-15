import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { terminalPlugin } from './config/vite-plugin-terminal';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), terminalPlugin()],
	server: {
		host: '0.0.0.0',
		port: 5173
	},
	optimizeDeps: {
		include: ['leaflet', 'cytoscape', 'mgrs']
	},
	ssr: {
		noExternal: ['mgrs']
	},
	define: {
		// Helps with Node.js compatibility issues
		global: 'globalThis'
	}
});
