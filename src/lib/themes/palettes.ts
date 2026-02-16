/**
 * Palette Definitions — 8 shadcn color palettes with full CSS variable overrides
 * Values sourced from official shadcn-ui/ui repository (apps/v4/registry/_legacy-base-colors.ts)
 * Each palette defines dark mode values for all semantic CSS variables.
 */

import type { ThemePalette } from '$lib/stores/theme-store.svelte';

export interface PaletteDefinition {
	name: string;
	label: ThemePalette;
	cssVars: {
		dark: Record<string, string>;
	};
}

export const palettes: PaletteDefinition[] = [
	{
		name: 'Default',
		label: 'default',
		cssVars: {
			dark: {
				'--background': '240 10% 3.9%',
				'--foreground': '0 0% 98%',
				'--card': '240 10% 3.9%',
				'--card-foreground': '0 0% 98%',
				'--popover': '240 10% 3.9%',
				'--popover-foreground': '0 0% 98%',
				'--primary': '0 0% 98%',
				'--primary-foreground': '240 5.9% 10%',
				'--secondary': '240 3.7% 15.9%',
				'--secondary-foreground': '0 0% 98%',
				'--muted': '240 3.7% 15.9%',
				'--muted-foreground': '240 5% 64.9%',
				'--accent': '240 3.7% 15.9%',
				'--accent-foreground': '0 0% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '0 0% 98%',
				'--border': '240 3.7% 15.9%',
				'--input': '240 3.7% 15.9%',
				'--ring': '240 4.9% 83.9%'
			}
		}
	},
	{
		name: 'Blue',
		label: 'blue',
		cssVars: {
			dark: {
				'--background': '222.2 84% 4.9%',
				'--foreground': '210 40% 98%',
				'--card': '222.2 84% 4.9%',
				'--card-foreground': '210 40% 98%',
				'--popover': '222.2 84% 4.9%',
				'--popover-foreground': '210 40% 98%',
				'--primary': '217.2 91.2% 59.8%',
				'--primary-foreground': '222.2 47.4% 11.2%',
				'--secondary': '217.2 32.6% 17.5%',
				'--secondary-foreground': '210 40% 98%',
				'--muted': '217.2 32.6% 17.5%',
				'--muted-foreground': '215 20.2% 65.1%',
				'--accent': '217.2 32.6% 17.5%',
				'--accent-foreground': '210 40% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '210 40% 98%',
				'--border': '217.2 32.6% 17.5%',
				'--input': '217.2 32.6% 17.5%',
				'--ring': '224.3 76.3% 48%'
			}
		}
	},
	{
		name: 'Green',
		label: 'green',
		cssVars: {
			dark: {
				'--background': '20 14.3% 4.1%',
				'--foreground': '0 0% 95%',
				'--card': '24 9.8% 10%',
				'--card-foreground': '0 0% 95%',
				'--popover': '0 0% 9%',
				'--popover-foreground': '0 0% 95%',
				'--primary': '142.1 70.6% 45.3%',
				'--primary-foreground': '144.9 80.4% 10%',
				'--secondary': '240 3.7% 15.9%',
				'--secondary-foreground': '0 0% 98%',
				'--muted': '0 0% 15%',
				'--muted-foreground': '240 5% 64.9%',
				'--accent': '12 6.5% 15.1%',
				'--accent-foreground': '0 0% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '0 0% 98%',
				'--border': '240 3.7% 15.9%',
				'--input': '240 3.7% 15.9%',
				'--ring': '142.4 71.8% 29.2%'
			}
		}
	},
	{
		name: 'Orange',
		label: 'orange',
		cssVars: {
			dark: {
				'--background': '20 14.3% 4.1%',
				'--foreground': '60 9.1% 97.8%',
				'--card': '20 14.3% 4.1%',
				'--card-foreground': '60 9.1% 97.8%',
				'--popover': '20 14.3% 4.1%',
				'--popover-foreground': '60 9.1% 97.8%',
				'--primary': '20.5 90.2% 48.2%',
				'--primary-foreground': '60 9.1% 97.8%',
				'--secondary': '12 6.5% 15.1%',
				'--secondary-foreground': '60 9.1% 97.8%',
				'--muted': '12 6.5% 15.1%',
				'--muted-foreground': '24 5.4% 63.9%',
				'--accent': '12 6.5% 15.1%',
				'--accent-foreground': '60 9.1% 97.8%',
				'--destructive': '0 72.2% 50.6%',
				'--destructive-foreground': '60 9.1% 97.8%',
				'--border': '12 6.5% 15.1%',
				'--input': '12 6.5% 15.1%',
				'--ring': '20.5 90.2% 48.2%'
			}
		}
	},
	{
		name: 'Red',
		label: 'red',
		cssVars: {
			dark: {
				'--background': '0 0% 3.9%',
				'--foreground': '0 0% 98%',
				'--card': '0 0% 3.9%',
				'--card-foreground': '0 0% 98%',
				'--popover': '0 0% 3.9%',
				'--popover-foreground': '0 0% 98%',
				'--primary': '0 72.2% 50.6%',
				'--primary-foreground': '0 85.7% 97.3%',
				'--secondary': '0 0% 14.9%',
				'--secondary-foreground': '0 0% 98%',
				'--muted': '0 0% 14.9%',
				'--muted-foreground': '0 0% 63.9%',
				'--accent': '0 0% 14.9%',
				'--accent-foreground': '0 0% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '0 0% 98%',
				'--border': '0 0% 14.9%',
				'--input': '0 0% 14.9%',
				'--ring': '0 72.2% 50.6%'
			}
		}
	},
	{
		name: 'Rose',
		label: 'rose',
		cssVars: {
			dark: {
				'--background': '20 14.3% 4.1%',
				'--foreground': '0 0% 95%',
				'--card': '24 9.8% 10%',
				'--card-foreground': '0 0% 95%',
				'--popover': '0 0% 9%',
				'--popover-foreground': '0 0% 95%',
				'--primary': '346.8 77.2% 49.8%',
				'--primary-foreground': '355.7 100% 97.3%',
				'--secondary': '240 3.7% 15.9%',
				'--secondary-foreground': '0 0% 98%',
				'--muted': '0 0% 15%',
				'--muted-foreground': '240 5% 64.9%',
				'--accent': '12 6.5% 15.1%',
				'--accent-foreground': '0 0% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '0 0% 98%',
				'--border': '240 3.7% 15.9%',
				'--input': '240 3.7% 15.9%',
				'--ring': '346.8 77.2% 49.8%'
			}
		}
	},
	{
		name: 'Violet',
		label: 'violet',
		cssVars: {
			dark: {
				'--background': '224 71.4% 4.1%',
				'--foreground': '210 20% 98%',
				'--card': '224 71.4% 4.1%',
				'--card-foreground': '210 20% 98%',
				'--popover': '224 71.4% 4.1%',
				'--popover-foreground': '210 20% 98%',
				'--primary': '263.4 70% 50.4%',
				'--primary-foreground': '210 20% 98%',
				'--secondary': '215 27.9% 16.9%',
				'--secondary-foreground': '210 20% 98%',
				'--muted': '215 27.9% 16.9%',
				'--muted-foreground': '217.9 10.6% 64.9%',
				'--accent': '215 27.9% 16.9%',
				'--accent-foreground': '210 20% 98%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '210 20% 98%',
				'--border': '215 27.9% 16.9%',
				'--input': '215 27.9% 16.9%',
				'--ring': '263.4 70% 50.4%'
			}
		}
	},
	{
		name: 'Yellow',
		label: 'yellow',
		cssVars: {
			dark: {
				'--background': '20 14.3% 4.1%',
				'--foreground': '60 9.1% 97.8%',
				'--card': '20 14.3% 4.1%',
				'--card-foreground': '60 9.1% 97.8%',
				'--popover': '20 14.3% 4.1%',
				'--popover-foreground': '60 9.1% 97.8%',
				'--primary': '47.9 95.8% 53.1%',
				'--primary-foreground': '26 83.3% 14.1%',
				'--secondary': '12 6.5% 15.1%',
				'--secondary-foreground': '60 9.1% 97.8%',
				'--muted': '12 6.5% 15.1%',
				'--muted-foreground': '24 5.4% 63.9%',
				'--accent': '12 6.5% 15.1%',
				'--accent-foreground': '60 9.1% 97.8%',
				'--destructive': '0 62.8% 30.6%',
				'--destructive-foreground': '0 0% 98%',
				'--border': '12 6.5% 15.1%',
				'--input': '12 6.5% 15.1%',
				'--ring': '35.5 91.7% 32.9%'
			}
		}
	}
];
