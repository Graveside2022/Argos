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
	critical: { var: '--signal-critical', fallback: '#dc2626' },
	strong: { var: '--signal-strong', fallback: '#f97316' },
	good: { var: '--signal-good', fallback: '#fbbf24' },
	fair: { var: '--signal-fair', fallback: '#10b981' },
	weak: { var: '--signal-weak', fallback: '#4a90e2' }
} as const;

// ── General map UI colors (fallbacks for CSS vars) ───────────────────
export const MAP_UI_COLORS = {
	foreground: { var: '--foreground', fallback: '#e0e0e8' },
	mutedForeground: { var: '--muted-foreground', fallback: '#888' },
	background: { var: '--background', fallback: '#111119' },
	secondary: { var: '--secondary', fallback: '#3a3a5c' },
	border: { var: '--border', fallback: '#6a6a8e' },
	primary: { var: '--primary', fallback: '#4a9eff' }
} as const;

/** Resolve a MAP_UI_COLORS or SIGNAL_COLORS entry to its current hex. */
export function resolveMapColor(entry: { var: string; fallback: string }): string {
	return resolveThemeColor(entry.var, entry.fallback);
}
