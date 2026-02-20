import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$app: path.resolve('./.svelte-kit/runtime/app')
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['tests/e2e/**', 'node_modules/**'],
		testTimeout: 30000,
		hookTimeout: 30000,
		// RPi5 memory constraints: limit to single worker to prevent OOM
		maxWorkers: 1,
		minWorkers: 1,
		pool: 'forks',
		coverage: {
			provider: 'v8',
			enabled: true,
			reportsDirectory: './coverage',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'tests/',
				'**/*.d.ts',
				'**/*.config.ts',
				'**/*.config.js',
				'build/',
				'.svelte-kit/'
			]
		}
	}
});
