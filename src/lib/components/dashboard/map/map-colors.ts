/**
 * Map paint color constants.
 *
 * Each entry pairs a CSS custom-property name with its hex fallback.
 * Components call `resolveThemeColor(VAR, FALLBACK)` at render time,
 * so the map adapts when the global theme changes.
 */
import { resolveThemeColor } from '$lib/utils/theme-colors';

// ── Signal-strength band colors ──────────────────────────────────────
export const SIGNAL_COLORS = {
	critical: { var: '--signal-very-strong', fallback: '#c45b4a' },
	strong: { var: '--signal-strong', fallback: '#d4a054' },
	good: { var: '--signal-good', fallback: '#c4a84a' },
	fair: { var: '--signal-fair', fallback: '#8bbfa0' },
	weak: { var: '--signal-weak', fallback: '#809ad0' }
} as const;

// ── General map UI colors (fallbacks for CSS vars) ───────────────────
export const MAP_UI_COLORS = {
	foreground: { var: '--foreground', fallback: '#ffffff' },
	mutedForeground: { var: '--muted-foreground', fallback: '#666666' },
	background: { var: '--background', fallback: '#111111' },
	secondary: { var: '--secondary', fallback: '#2e2e2e' },
	border: { var: '--border', fallback: '#2e2e2e' },
	primary: { var: '--primary', fallback: '#a8b8e0' }
} as const;

/** Resolve a MAP_UI_COLORS or SIGNAL_COLORS entry to its current hex. */
export function resolveMapColor(entry: { var: string; fallback: string }): string {
	return resolveThemeColor(entry.var, entry.fallback);
}
