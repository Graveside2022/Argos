/**
 * Theme Store — Manages palette and layout state (dark mode only)
 * Persists to localStorage under 'argos-theme' key
 * DOM attributes managed: data-palette on <html>, dark class (always applied)
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

export type RailPosition = 'left' | 'right' | 'top' | 'bottom';

export interface ThemeState {
	palette: ThemePalette;
	railPosition: RailPosition;
}

const STORAGE_KEY = 'argos-theme';

const DEFAULT_STATE: ThemeState = {
	palette: 'default',
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

function applyDarkMode(): void {
	if (!browser) return;
	document.documentElement.classList.add('dark');
}

function createThemeStore() {
	let state = $state<ThemeState>(loadState());

	// Apply initial DOM state — always dark mode
	if (browser) {
		applyPalette(state.palette);
		applyDarkMode();
	}

	return {
		get palette() {
			return state.palette;
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

		setRailPosition(position: RailPosition) {
			if (!VALID_RAIL_POSITIONS.includes(position)) return;
			state.railPosition = position;
			saveState(state);
		}
	};
}

export const themeStore = createThemeStore();
