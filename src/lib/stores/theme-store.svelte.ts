/**
 * Theme Store — Manages palette, mode, and semantic colors state
 * Persists to localStorage under 'argos-theme' key
 * DOM attributes managed: data-palette on <html>, dark class, semantic-colors-off class
 */

import { browser } from '$app/environment';

export type ThemePalette =
	| 'default'
	| 'blue'
	| 'green'
	| 'orange'
	| 'red'
	| 'rose'
	| 'violet'
	| 'yellow';

export type ThemeMode = 'dark' | 'light';

export interface ThemeState {
	palette: ThemePalette;
	mode: ThemeMode;
	semanticColors: boolean;
}

const STORAGE_KEY = 'argos-theme';

const DEFAULT_STATE: ThemeState = {
	palette: 'default',
	mode: 'dark',
	semanticColors: true
};

const VALID_PALETTES: ThemePalette[] = [
	'default',
	'blue',
	'green',
	'orange',
	'red',
	'rose',
	'violet',
	'yellow'
];

function loadState(): ThemeState {
	if (!browser) return { ...DEFAULT_STATE };

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULT_STATE };

		const parsed = JSON.parse(raw);
		return {
			palette: VALID_PALETTES.includes(parsed.palette)
				? parsed.palette
				: DEFAULT_STATE.palette,
			mode: parsed.mode === 'light' ? 'light' : 'dark',
			semanticColors:
				typeof parsed.semanticColors === 'boolean'
					? parsed.semanticColors
					: DEFAULT_STATE.semanticColors
		};
	} catch {
		return { ...DEFAULT_STATE };
	}
}

function saveState(state: ThemeState): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// QuotaExceededError or other storage failure — silently ignore
	}
}

function applyPalette(palette: ThemePalette): void {
	if (!browser) return;
	const el = document.documentElement;

	if (palette === 'default') {
		delete el.dataset.palette;
	} else {
		el.dataset.palette = palette;
	}
}

function applyMode(mode: ThemeMode): void {
	if (!browser) return;
	const el = document.documentElement;

	if (mode === 'dark') {
		el.classList.add('dark');
	} else {
		el.classList.remove('dark');
	}
}

function applySemanticColors(enabled: boolean): void {
	if (!browser) return;
	const el = document.documentElement;

	if (enabled) {
		el.classList.remove('semantic-colors-off');
	} else {
		el.classList.add('semantic-colors-off');
	}
}

function createThemeStore() {
	let state = $state<ThemeState>(loadState());

	// Apply initial DOM state
	if (browser) {
		applyPalette(state.palette);
		applyMode(state.mode);
		applySemanticColors(state.semanticColors);
	}

	return {
		get palette() {
			return state.palette;
		},
		get mode() {
			return state.mode;
		},
		get semanticColors() {
			return state.semanticColors;
		},

		setPalette(palette: ThemePalette) {
			if (!VALID_PALETTES.includes(palette)) return;
			state.palette = palette;
			applyPalette(palette);
			saveState(state);
		},

		setMode(mode: ThemeMode) {
			if (mode !== 'dark' && mode !== 'light') return;
			state.mode = mode;
			applyMode(mode);
			saveState(state);
		},

		setSemanticColors(enabled: boolean) {
			state.semanticColors = enabled;
			applySemanticColors(enabled);
			saveState(state);
		}
	};
}

export const themeStore = createThemeStore();
