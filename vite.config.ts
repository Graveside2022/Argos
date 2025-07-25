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
		port: 5173,
		strictPort: true, // Fail instead of auto-selecting ports
		host: '0.0.0.0',
		hmr: {
			timeout: 60000,
			overlay: false,
			// Disable HMR for specific paths that might be causing issues
			protocol: 'ws',
			// Use the actual IP address instead of 'true'
			host: '100.79.154.94',
			port: 5173
		},
		// Reduce module runner instability
		middlewareMode: false,
		fs: {
			strict: false
		},
		// Add watch options to prevent false positive file changes
		watch: {
			// Ignore files that might be changing
			ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**', '**/*.log', '**/*.kismet']
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