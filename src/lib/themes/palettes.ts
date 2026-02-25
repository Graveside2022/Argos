/**
 * Palette Definitions — 13 Lunaris MIL-STD accent themes
 * Each palette only overrides --primary. All other tokens remain constant.
 * Values sourced from the Lunaris .pen design reference.
 */

import type { ThemePalette } from '$lib/stores/theme-store.svelte';

export interface PaletteDefinition {
	name: string;
	label: ThemePalette;
	cssVars: {
		'--primary': string;
	};
}

export const palettes: PaletteDefinition[] = [
	{ name: 'Ash', label: 'ash', cssVars: { '--primary': '#aeaeb4' } },
	{ name: 'Blue ★', label: 'blue', cssVars: { '--primary': '#a8b8e0' } },
	{ name: 'Blush', label: 'blush', cssVars: { '--primary': '#d8bdb4' } },
	{ name: 'Iron', label: 'iron', cssVars: { '--primary': '#b4bbc4' } },
	{ name: 'Iris', label: 'iris', cssVars: { '--primary': '#acafe0' } },
	{ name: 'Khaki', label: 'khaki', cssVars: { '--primary': '#ccbc9e' } },
	{ name: 'Mauve', label: 'mauve', cssVars: { '--primary': '#d0b0c0' } },
	{ name: 'Pewter', label: 'pewter', cssVars: { '--primary': '#c0c0c8' } },
	{ name: 'Plum', label: 'plum', cssVars: { '--primary': '#c4b0c8' } },
	{ name: 'Rose', label: 'rose', cssVars: { '--primary': '#d4b4bc' } },
	{ name: 'Sand', label: 'sand', cssVars: { '--primary': '#e0d4bc' } },
	{ name: 'Silver', label: 'silver', cssVars: { '--primary': '#b8b8c0' } },
	{ name: 'Violet', label: 'violet', cssVars: { '--primary': '#bdb2d4' } }
];
