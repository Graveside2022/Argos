import { type Writable, writable } from 'svelte/store';

import type { KismetDevice } from '$lib/kismet/types';
import type { LeafletMarker } from '$lib/types/map';

export type Affiliation = 'friendly' | 'hostile' | 'unknown';

export interface KismetState {
	status: 'stopped' | 'starting' | 'running' | 'stopping';
	devices: Map<string, KismetDevice>;
	deviceMarkers: Map<string, LeafletMarker>;
	deviceCount: number;
	whitelistMAC: string;
	deviceAffiliations: Map<string, Affiliation>;
	message?: string; // Status message for agent context
	distributions: {
		byType: Map<string, number>;
		byManufacturer: Map<string, number>;
		byChannel: Map<string, number>;
	};
}

const initialKismetState: KismetState = {
	status: 'stopped',
	devices: new Map(),
	deviceMarkers: new Map(),
	deviceCount: 0,
	whitelistMAC: '',
	deviceAffiliations: new Map(),
	distributions: {
		byType: new Map(),
		byManufacturer: new Map(),
		byChannel: new Map()
	}
};

export const kismetStore: Writable<KismetState> = writable(initialKismetState);

// Helper functions to update store
export const setKismetStatus = (status: 'stopped' | 'starting' | 'running' | 'stopping') => {
	kismetStore.update((state) => ({ ...state, status }));
};

export const setWhitelistMAC = (mac: string) => {
	kismetStore.update((state) => ({ ...state, whitelistMAC: mac }));
};

export const setDeviceAffiliation = (mac: string, affiliation: Affiliation) => {
	kismetStore.update((state) => {
		const newAffiliations = new Map(state.deviceAffiliations);
		if (affiliation === 'unknown') {
			newAffiliations.delete(mac.toUpperCase());
		} else {
			newAffiliations.set(mac.toUpperCase(), affiliation);
		}
		return { ...state, deviceAffiliations: newAffiliations };
	});
};

export const addKismetDevice = (device: KismetDevice) => {
	kismetStore.update((state) => {
		const newDevices = new Map(state.devices);
		newDevices.set(device.mac, device);
		return {
			...state,
			devices: newDevices,
			deviceCount: newDevices.size
		};
	});
};

export const updateKismetDevice = (mac: string, updates: Partial<KismetDevice>) => {
	kismetStore.update((state) => {
		const newDevices = new Map(state.devices);
		const existingDevice = newDevices.get(mac);
		if (existingDevice) {
			newDevices.set(mac, { ...existingDevice, ...updates });
		}
		return { ...state, devices: newDevices };
	});
};

export const removeKismetDevice = (mac: string) => {
	kismetStore.update((state) => {
		const newDevices = new Map(state.devices);
		newDevices.delete(mac);
		return {
			...state,
			devices: newDevices,
			deviceCount: newDevices.size
		};
	});
};

export const clearAllKismetDevices = () => {
	kismetStore.update((state) => ({
		...state,
		devices: new Map(),
		deviceMarkers: new Map(),
		deviceCount: 0,
		distributions: {
			byType: new Map(),
			byManufacturer: new Map(),
			byChannel: new Map()
		}
	}));
};

export const addKismetDeviceMarker = (mac: string, marker: LeafletMarker) => {
	kismetStore.update((state) => {
		const newMarkers = new Map(state.deviceMarkers);
		newMarkers.set(`kismet_${mac}`, marker);
		return { ...state, deviceMarkers: newMarkers };
	});
};

export const removeKismetDeviceMarker = (mac: string) => {
	kismetStore.update((state) => {
		const newMarkers = new Map(state.deviceMarkers);
		newMarkers.delete(`kismet_${mac}`);
		return { ...state, deviceMarkers: newMarkers };
	});
};

/** Increment a counter in a Map. */
function incr(map: Map<string, number>, key: string): void {
	map.set(key, (map.get(key) || 0) + 1);
}

/** Tally device counts per a named field. */
function tallyField(
	devices: KismetDevice[],
	extract: (d: KismetDevice) => string
): Map<string, number> {
	const map = new Map<string, number>();
	for (const d of devices) incr(map, extract(d));
	return map;
}

/** Build distribution maps from a device collection. */
function buildDistributions(devices: KismetDevice[]) {
	return {
		byType: tallyField(devices, (d) => d.type || 'Unknown'),
		byManufacturer: tallyField(devices, (d) => d.manufacturer || 'Unknown'),
		byChannel: tallyField(devices, (d) => d.channel?.toString() || 'Unknown')
	};
}

/** Remove stale MACs from a device map. */
function pruneStale(
	existing: Map<string, KismetDevice>,
	incomingMACs: Set<string>
): Map<string, KismetDevice> {
	const result = new Map(existing);
	for (const mac of existing.keys()) {
		if (!incomingMACs.has(mac)) result.delete(mac);
	}
	return result;
}

/**
 * Batch-update all devices in a single store mutation.
 * Replaces per-device addKismetDevice() forEach loops that fire N individual updates.
 */
export const batchUpdateDevices = (
	incomingDevices: KismetDevice[],
	existingDevices: Map<string, KismetDevice>
) => {
	const newDevices = pruneStale(existingDevices, new Set(incomingDevices.map((d) => d.mac)));
	for (const device of incomingDevices) newDevices.set(device.mac, device);

	kismetStore.update((state) => ({
		...state,
		devices: newDevices,
		deviceCount: newDevices.size,
		distributions: buildDistributions(incomingDevices)
	}));
};

export const updateDistributions = (devices: Map<string, KismetDevice>) => {
	kismetStore.update((state) => ({
		...state,
		distributions: buildDistributions([...devices.values()])
	}));
};
