import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	css: {
		postcss: './config/postcss.config.js'
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	// Vite 7.x SSR stability optimizations
	ssr: {
		noExternal: ['@deck.gl/core', '@deck.gl/layers', 'leaflet', 'cytoscape', 'leaflet.heat', 'leaflet.markercluster']
	},
	optimizeDeps: {
		include: ['leaflet', 'cytoscape', 'ws', 'better-sqlite3'],
		exclude: ['@deck.gl/core', '@deck.gl/layers']
	},
	server: {
		hmr: {
			timeout: 60000,
			overlay: false
		},
		// Reduce module runner instability
		middlewareMode: false,
		fs: {
			strict: false
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'vendor-maps': ['leaflet', 'leaflet.heat', 'leaflet.markercluster'],
					'vendor-3d': ['@deck.gl/core', '@deck.gl/layers'],
					'vendor-graph': ['cytoscape']
				}
			}
		},
		// Reduce memory pressure
		chunkSizeWarningLimit: 1000
	}
});