/**
 * xterm.js terminal theme constants.
 *
 * UI chrome colors adapt to the CSS theme via resolveThemeColor();
 * the 16 ANSI palette colors are fixed protocol constants.
 */
import type { ITheme } from '@xterm/xterm';

import { resolveThemeColor } from '$lib/utils/theme-colors';

// ── Fixed ANSI 16-color palette ──────────────────────────────────────
// These are standard terminal emulator colors, not theme-variable targets.
export const ANSI_COLORS = {
	black: '#16181d',
	red: '#f87171',
	green: '#4ade80',
	yellow: '#fbbf24',
	blue: '#4a9eff',
	magenta: '#a78bfa',
	cyan: '#22d3ee',
	white: '#e8eaed',
	brightBlack: '#5f6368',
	brightRed: '#fca5a5',
	brightGreen: '#86efac',
	brightYellow: '#fde047',
	brightBlue: '#60a5fa',
	brightMagenta: '#c4b5fd',
	brightCyan: '#67e8f9',
	brightWhite: '#ffffff'
} as const;

// ── UI chrome fallback defaults ──────────────────────────────────────
const CHROME_BACKGROUND = '#151515';
const CHROME_SELECTION_FG = '#ffffff';

/** Build the full xterm.js ITheme, resolving CSS vars at call time. */
export function buildTerminalTheme(): ITheme {
	return {
		background: CHROME_BACKGROUND,
		foreground: resolveThemeColor('--foreground', '#ffffff'),
		cursor: resolveThemeColor('--primary', '#a8b8e0'),
		cursorAccent: CHROME_BACKGROUND,
		selectionBackground: resolveThemeColor('--accent', 'rgba(168, 184, 224, 0.3)'),
		selectionForeground: CHROME_SELECTION_FG,
		// @constitutional-exemption Article-IV issue:#11 — 16 ANSI standard colors are protocol constants, not theme colors
		...ANSI_COLORS
	};
}
