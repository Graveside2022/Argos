/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./src/routes/**/*.{html,js,svelte,ts}',
		'./src/lib/**/*.{html,js,svelte,ts}',
		'./src/app.html'
	],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#e8f4ff',
					500: '#4a9eff',
					600: '#3a8eef',
					700: '#2a7edf',
					900: '#1a4e8f'
				},
				// Border colors
				'border-hover': '#4a9eff',
				'border-primary': '#2c2f36',
				// Text colors
				'text-primary': '#e8eaed',
				'text-secondary': '#9aa0a6',
				'text-muted': '#5f6368',
				// Background colors
				'bg-secondary': '#16181d',
				'bg-primary': '#0e1116',
				'bg-card': '#1c1f26',
				'bg-button': '#2a2d35',
				'bg-input': '#1a1d23',
				// Accent colors
				'accent-primary': '#4a9eff',
				'accent-hover': '#3a8eef',
				// Signal colors
				'signal-critical': '#dc2626',
				'signal-strong': '#f97316',
				'signal-good': '#fbbf24',
				'signal-fair': '#10b981',
				'signal-weak': '#4a90e2',
				// Status colors
				'status-success': '#4ade80',
				'status-warning': '#fbbf24',
				'status-error': '#f87171'
			}
		}
	},
	plugins: [require('@tailwindcss/forms')]
};
