import { get, writable } from 'svelte/store';

import { browser } from '$app/environment';

export type VisibilityMode = 'dynamic' | 'all' | 'manual';

const STORAGE_KEY = 'argos-visibility-mode';
const PROMOTED_KEY = 'argos-promoted-devices';

/** Signal strength threshold for "Dynamic Filter" mode (dBm). Devices weaker than this are hidden. */
const DYNAMIC_RSSI_THRESHOLD = -80;
/** Recency threshold for "Dynamic Filter" mode (seconds). Devices older than this are hidden. */
const DYNAMIC_RECENCY_SECS = 300;

function loadMode(): VisibilityMode {
	if (!browser) return 'dynamic';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'all' || saved === 'manual' || saved === 'dynamic') return saved;
	return 'dynamic';
}

function loadPromoted(): Set<string> {
	if (!browser) return new Set();
	try {
		const saved = localStorage.getItem(PROMOTED_KEY);
		if (saved) return new Set(JSON.parse(saved));
	} catch {
		// Corrupted data — start fresh
	}
	return new Set();
}

function savePromoted(macs: Set<string>) {
	if (!browser) return;
	localStorage.setItem(PROMOTED_KEY, JSON.stringify([...macs]));
}

/** Visibility mode store — persisted to localStorage */
export const visibilityMode = writable<VisibilityMode>(loadMode());

/** Set of manually promoted device MACs — visible in all modes */
export const promotedDevices = writable<Set<string>>(loadPromoted());

// Persist on changes
if (browser) {
	visibilityMode.subscribe((mode) => localStorage.setItem(STORAGE_KEY, mode));
	promotedDevices.subscribe((macs) => savePromoted(macs));
}

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
			return devices.filter((d) => {
				// Promoted devices always pass
				if (promoted.has(d.mac)) return true;
				// Filter out weak signals
				if (d.rssi < DYNAMIC_RSSI_THRESHOLD && d.rssi !== 0) return false;
				// Filter out stale devices
				if (d.lastSeen > 0 && nowSecs - d.lastSeen > DYNAMIC_RECENCY_SECS) return false;
				return true;
			});

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
