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
					900: '#1e3a8a',
				},
				'border-hover': '#4f46e5',
				'text-primary': '#f8fafc',
				'text-muted': '#64748b',
				'bg-secondary': '#1e293b',
				'bg-primary': '#0f172a'
			}
		}
	},
	plugins: [
		require('@tailwindcss/forms')
	]
};