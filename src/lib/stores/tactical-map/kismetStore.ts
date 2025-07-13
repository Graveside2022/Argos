import { writable, type Writable } from 'svelte/store';
import type { KismetDevice } from '$lib/types/kismet';

export interface KismetState {
	status: 'stopped' | 'starting' | 'running' | 'stopping';
	devices: Map<string, KismetDevice>;
	deviceMarkers: Map<string, any>; // Leaflet markers
	deviceCount: number;
	whitelistMAC: string;
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
	distributions: {
		byType: new Map(),
		byManufacturer: new Map(),
		byChannel: new Map()
	}
};

export const kismetStore: Writable<KismetState> = writable(initialKismetState);

// Helper functions to update store
export const setKismetStatus = (status: 'stopped' | 'starting' | 'running' | 'stopping') => {
	kismetStore.update(state => ({ ...state, status }));
};

export const setWhitelistMAC = (mac: string) => {
	kismetStore.update(state => ({ ...state, whitelistMAC: mac }));
};

export const addKismetDevice = (device: KismetDevice) => {
	kismetStore.update(state => {
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
	kismetStore.update(state => {
		const newDevices = new Map(state.devices);
		const existingDevice = newDevices.get(mac);
		if (existingDevice) {
			newDevices.set(mac, { ...existingDevice, ...updates });
		}
		return { ...state, devices: newDevices };
	});
};

export const removeKismetDevice = (mac: string) => {
	kismetStore.update(state => {
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
	kismetStore.update(state => ({
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

export const addKismetDeviceMarker = (mac: string, marker: any) => {
	kismetStore.update(state => {
		const newMarkers = new Map(state.deviceMarkers);
		newMarkers.set(`kismet_${mac}`, marker);
		return { ...state, deviceMarkers: newMarkers };
	});
};

export const removeKismetDeviceMarker = (mac: string) => {
	kismetStore.update(state => {
		const newMarkers = new Map(state.deviceMarkers);
		newMarkers.delete(`kismet_${mac}`);
		return { ...state, deviceMarkers: newMarkers };
	});
};

export const updateDistributions = (devices: Map<string, KismetDevice>) => {
	const byType = new Map<string, number>();
	const byManufacturer = new Map<string, number>();
	const byChannel = new Map<string, number>();

	devices.forEach(device => {
		// Update type distribution
		const type = device.type || 'Unknown';
		byType.set(type, (byType.get(type) || 0) + 1);

		// Update manufacturer distribution
		const manufacturer = device.manufacturer || 'Unknown';
		byManufacturer.set(manufacturer, (byManufacturer.get(manufacturer) || 0) + 1);

		// Update channel distribution
		const channel = device.channel?.toString() || 'Unknown';
		byChannel.set(channel, (byChannel.get(channel) || 0) + 1);
	});

	kismetStore.update(state => ({
		...state,
		distributions: { byType, byManufacturer, byChannel }
	}));
};