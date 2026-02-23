import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { terminalPlugin } from './config/vite-plugin-terminal';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), terminalPlugin()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		watch: {
			ignored: ['**/*.db', '**/*.db-wal', '**/*.db-shm', '**/*.sqlite']
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('maplibre-gl')) return 'vendor-maplibre';
					if (id.includes('mil-sym-ts')) return 'vendor-milsym';
					if (id.includes('xterm')) return 'vendor-xterm';
				}
			}
		}
	},
	optimizeDeps: {
		include: ['leaflet', 'cytoscape', 'mgrs']
	},
	ssr: {
		noExternal: ['mgrs', 'mode-watcher']
	},
	define: {
		global: 'globalThis'
	}
});
