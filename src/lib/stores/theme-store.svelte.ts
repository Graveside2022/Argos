/**
 * Theme Store — Manages palette, mode, and layout state
 * Persists to localStorage under 'argos-theme' key
 * DOM attributes managed: data-palette on <html>, dark class
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

export type RailPosition = 'left' | 'right' | 'top' | 'bottom';

export interface ThemeState {
	palette: ThemePalette;
	mode: ThemeMode;
	railPosition: RailPosition;
}

const STORAGE_KEY = 'argos-theme';

const DEFAULT_STATE: ThemeState = {
	palette: 'default',
	mode: 'dark',
	railPosition: 'left'
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

const VALID_RAIL_POSITIONS: RailPosition[] = ['left', 'right', 'top', 'bottom'];

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
			railPosition: VALID_RAIL_POSITIONS.includes(parsed.railPosition)
				? parsed.railPosition
				: DEFAULT_STATE.railPosition
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

function createThemeStore() {
	let state = $state<ThemeState>(loadState());

	// Apply initial DOM state
	if (browser) {
		applyPalette(state.palette);
		applyMode(state.mode);
	}

	return {
		get palette() {
			return state.palette;
		},
		get mode() {
			return state.mode;
		},
		get railPosition() {
			return state.railPosition;
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

		setRailPosition(position: RailPosition) {
			if (!VALID_RAIL_POSITIONS.includes(position)) return;
			state.railPosition = position;
			saveState(state);
		}
	};
}

export const themeStore = createThemeStore();
