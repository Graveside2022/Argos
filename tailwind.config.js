/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'border-hover': 'rgb(var(--border-hover) / <alpha-value>)',
        'bg-card': 'var(--bg-card)',
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-input': 'var(--bg-input)',
        'bg-hover': 'var(--bg-hover)',
        'bg-button': 'var(--bg-button)',
        'border-primary': 'rgb(var(--border-primary) / <alpha-value>)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'accent-primary': 'var(--accent-primary)',
        'accent-hover': 'var(--accent-hover)',
        'neon-cyan': 'var(--neon-cyan)',
        'neon-cyan-light': 'var(--neon-cyan-light)',
        'signal-strong': 'var(--signal-strong)',
        'signal-weak': 'var(--signal-weak)',
        'signal-moderate': 'var(--signal-moderate)',
        'signal-very-strong': 'var(--signal-very-strong)',
        'signal-none': 'var(--signal-none)'
      }
    },
  },
  plugins: [],
}