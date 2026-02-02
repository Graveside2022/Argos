/**
 * Signal strength utilities for the dashboard.
 * Maps RSSI values to Palantir design system signal colors.
 */

export interface SignalBand {
	key: string;
	label: string;
	min: number;
	cssVar: string;
}

/** Five signal strength bands using Palantir CSS variables */
export const signalBands: SignalBand[] = [
	{
		key: 'critical',
		label: '> -50 dBm (Very Strong)',
		min: -50,
		cssVar: '--palantir-signal-critical'
	},
	{
		key: 'strong',
		label: '-50 to -60 dBm (Strong)',
		min: -60,
		cssVar: '--palantir-signal-strong'
	},
	{ key: 'good', label: '-60 to -70 dBm (Good)', min: -70, cssVar: '--palantir-signal-good' },
	{ key: 'fair', label: '-70 to -80 dBm (Fair)', min: -80, cssVar: '--palantir-signal-fair' },
	{ key: 'weak', label: '< -80 dBm (Weak)', min: -Infinity, cssVar: '--palantir-signal-weak' }
];

/** Get the signal band key for an RSSI value */
export function getSignalBandKey(rssi: number): string {
	if (rssi > -50) return 'critical';
	if (rssi > -60) return 'strong';
	if (rssi > -70) return 'good';
	if (rssi > -80) return 'fair';
	return 'weak';
}

/** Get the Palantir CSS variable name for an RSSI value */
export function getSignalColor(rssi: number): string {
	const key = getSignalBandKey(rssi);
	const band = signalBands.find((b) => b.key === key);
	return band?.cssVar ?? '--palantir-signal-weak';
}

/** Get an inline hex color for contexts where CSS vars aren't available (e.g. Leaflet markers) */
export function getSignalHex(rssi: number): string {
	if (rssi > -50) return '#dc2626';
	if (rssi > -60) return '#f97316';
	if (rssi > -70) return '#fbbf24';
	if (rssi > -80) return '#10b981';
	return '#4a90e2';
}

/** Format "last seen" timestamp to human-readable relative time */
export function formatLastSeen(timestamp: number): string {
	const msTs = timestamp > 1e12 ? timestamp : timestamp * 1000;
	const secs = Math.floor((Date.now() - msTs) / 1000);
	if (secs < 5) return 'Just now';
	if (secs < 60) return `${secs}s ago`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
	return `${Math.floor(secs / 3600)}h ago`;
}
