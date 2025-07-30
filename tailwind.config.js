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
					50: '#f0f9ff',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					900: '#1e3a8a'
				},
				// Border colors
				'border-hover': '#4f46e5',
				'border-primary': '#374151',
				// Text colors
				'text-primary': '#f8fafc',
				'text-muted': '#64748b',
				// Background colors
				'bg-secondary': '#1e293b',
				'bg-primary': '#0f172a',
				'bg-card': '#1f2937',
				'bg-button': '#374151',
				'bg-input': '#1f2937',
				// Accent colors
				'accent-primary': '#3b82f6',
				'accent-hover': '#2563eb'
			}
		}
	},
	plugins: [require('@tailwindcss/forms')]
};
