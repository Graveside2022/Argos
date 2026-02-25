/**
 * Signal strength utilities for the dashboard.
 * Maps RSSI values to Lunaris design system signal colors.
 */

import { resolveThemeColor } from '$lib/utils/theme-colors';

export interface SignalBand {
	key: string;
	label: string;
	name: string;
	dbm: string;
	min: number;
	cssVar: string;
	range: string;
}

/** Five signal strength bands using Lunaris CSS variables */
export const signalBands: SignalBand[] = [
	{
		key: 'critical',
		name: 'Very Strong',
		dbm: '> -50 dBm',
		label: '> -50 dBm (Very Strong)',
		min: -50,
		cssVar: '--signal-very-strong',
		range: '25m'
	},
	{
		key: 'strong',
		name: 'Strong',
		dbm: '-50 to -60 dBm',
		label: '-50 to -60 dBm (Strong)',
		min: -60,
		cssVar: '--signal-strong',
		range: '60m'
	},
	{
		key: 'good',
		name: 'Good',
		dbm: '-60 to -70 dBm',
		label: '-60 to -70 dBm (Good)',
		min: -70,
		cssVar: '--signal-good',
		range: '100m'
	},
	{
		key: 'fair',
		name: 'Fair',
		dbm: '-70 to -80 dBm',
		label: '-70 to -80 dBm (Fair)',
		min: -80,
		cssVar: '--signal-fair',
		range: '175m'
	},
	{
		key: 'weak',
		name: 'Weak',
		dbm: '< -80 dBm',
		label: '< -80 dBm (Weak)',
		min: -Infinity,
		cssVar: '--signal-weak',
		range: '300m'
	}
];

/** Signal band thresholds: [minRssi, bandKey]. First match wins. */
const SIGNAL_THRESHOLDS: [number, string][] = [
	[-50, 'critical'],
	[-60, 'strong'],
	[-70, 'good'],
	[-80, 'fair']
];

/** Get the signal band key for an RSSI value */
export function getSignalBandKey(rssi: number): string {
	if (rssi === 0) return 'none';
	return SIGNAL_THRESHOLDS.find(([min]) => rssi > min)?.[1] ?? 'weak';
}

/** Signal hex color thresholds: [minRssi, cssVar, fallbackHex]. First match wins. */
const SIGNAL_HEX_THRESHOLDS: [number, string, string][] = [
	[-50, '--signal-very-strong', '#c45b4a'],
	[-60, '--signal-strong', '#d4a054'],
	[-70, '--signal-good', '#c4a84a'],
	[-80, '--signal-fair', '#8bbfa0']
];

const WEAK_SIGNAL: [string, string] = ['--signal-weak', '#809ad0'];

/** Resolve the CSS var name and fallback hex for an RSSI value. */
function resolveSignalPair(rssi: number): [string, string] {
	const match = SIGNAL_HEX_THRESHOLDS.find(([min]) => rssi > min);
	return match ? [match[1], match[2]] : WEAK_SIGNAL;
}

/** Get an inline hex color for contexts where CSS vars aren't available (e.g. Leaflet markers) */
export function getSignalHex(rssi: number): string {
	if (rssi === 0) return resolveThemeColor('--signal-none', '#555555');
	const [cssVar, fallback] = resolveSignalPair(rssi);
	return resolveThemeColor(cssVar, fallback);
}
