import { get } from 'svelte/store';

import { persistedWritable } from '$lib/stores/persisted-writable';

export type VisibilityMode = 'dynamic' | 'all' | 'manual';

/** Signal strength threshold for "Dynamic Filter" mode (dBm). Devices weaker than this are hidden. */
const DYNAMIC_RSSI_THRESHOLD = -80;
/** Recency threshold for "Dynamic Filter" mode (seconds). Devices older than this are hidden. */
const DYNAMIC_RECENCY_SECS = 300;

/** Visibility mode store — persisted to localStorage.
 *  Default: 'all' — shows every detected device on the map.
 *  'manual' only shows explicitly promoted devices (empty set on fresh load → nothing visible).
 *  'dynamic' auto-squelches weak/stale signals.
 */
export const visibilityMode = persistedWritable<VisibilityMode>('argos-visibility-mode-v2', 'all', {
	validate: (v) => (['dynamic', 'all', 'manual'].includes(v) ? v : null)
});

/** Set of manually promoted device MACs — visible in all modes */
export const promotedDevices = persistedWritable<Set<string>>('argos-promoted-devices', new Set(), {
	serialize: (macs) => JSON.stringify([...macs]),
	deserialize: (raw) => new Set(JSON.parse(raw))
});

/** Toggle a device's promoted status */
export function togglePromoted(mac: string) {
	promotedDevices.update((set) => {
		const next = new Set(set);
		if (next.has(mac)) {
			next.delete(mac);
		} else {
			next.add(mac);
		}
		return next;
	});
}

export interface DeviceForVisibility {
	mac: string;
	rssi: number;
	lastSeen: number; // Unix timestamp (seconds)
}

/** Check if a device passes the dynamic signal-strength and recency filters */
function isDynamicallyVisible(d: DeviceForVisibility, nowSecs: number): boolean {
	if (d.rssi < DYNAMIC_RSSI_THRESHOLD && d.rssi !== 0) return false;
	if (d.lastSeen > 0 && nowSecs - d.lastSeen > DYNAMIC_RECENCY_SECS) return false;
	return true;
}

/**
 * Filters a list of devices based on the current visibility mode.
 * Promoted devices are always visible regardless of mode.
 */
export function filterByVisibility(
	devices: DeviceForVisibility[],
	mode: VisibilityMode,
	promoted: Set<string>,
	nowSecs: number = Math.floor(Date.now() / 1000)
): DeviceForVisibility[] {
	switch (mode) {
		case 'all':
			return devices;

		case 'manual':
			return devices.filter((d) => promoted.has(d.mac));

		case 'dynamic':
			return devices.filter((d) => promoted.has(d.mac) || isDynamicallyVisible(d, nowSecs));

		default:
			return devices;
	}
}

/** Reactive helper: get current filter function bound to store values */
export function getVisibilityFilter() {
	const mode = get(visibilityMode);
	const promoted = get(promotedDevices);
	return (devices: DeviceForVisibility[]) => filterByVisibility(devices, mode, promoted);
}
