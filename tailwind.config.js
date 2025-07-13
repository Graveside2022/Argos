/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'border-hover': 'var(--border-hover)',
        'bg-card': 'var(--bg-card)',
        'border-primary': 'var(--border-primary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'accent-primary': 'var(--accent-primary)',
        'neon-cyan': 'var(--neon-cyan)',
        'signal-strong': 'var(--signal-strong)'
      }
    },
  },
  plugins: [],
}