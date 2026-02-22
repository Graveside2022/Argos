import type { Writable } from 'svelte/store';
import { derived, get, writable } from 'svelte/store';

import type { KismetAlert, KismetDevice, KismetNetwork, KismetStatus, KismetStore } from './types';

interface KismetDataUpdate {
	devices?: KismetDevice[];
	networks?: KismetNetwork[];
}

/** Mutable counter reference for generating unique alert IDs across store actions. */
interface AlertCounter {
	value: number;
}

// Maximum alerts to retain in memory. Older alerts are discarded to prevent
// unbounded growth that leads to memory exhaustion over long-running sessions.
const MAX_ALERTS = 500;

/** Build the default KismetStore state used at store creation time. */
function createInitialState(): KismetStore {
	return {
		devices: [],
		networks: [],
		alerts: [],
		status: {
			kismet_running: false,
			wigle_running: false,
			gps_running: false
		},
		gps: {
			status: 'No Fix',
			lat: 'N/A',
			lon: 'N/A',
			alt: 'N/A',
			time: 'N/A'
		},
		lastUpdate: null,
		startTime: null
	};
}

/**
 * Compute the next store state when Kismet service status changes.
 * Tracks startTime: set when Kismet transitions to running, cleared when it stops.
 */
function computeStatusUpdate(current: KismetStore, status: Partial<KismetStatus>): KismetStore {
	const newStatus = { ...current.status, ...status };

	let startTime = current.startTime;
	if (newStatus.kismet_running && !current.status.kismet_running) {
		startTime = Date.now();
	} else if (!newStatus.kismet_running && current.status.kismet_running) {
		startTime = null;
	}

	return { ...current, status: newStatus, startTime };
}

/**
 * Create alerts for devices not previously seen in the store.
 * Each alert receives a unique ID via the shared counter reference.
 */
function createNewDeviceAlerts(
	existingDevices: KismetDevice[],
	incomingDevices: KismetDevice[],
	counter: AlertCounter
): KismetAlert[] {
	const existingMacs = new Set(existingDevices.map((d) => d.mac));
	const alerts: KismetAlert[] = [];

	for (const device of incomingDevices) {
		if (!existingMacs.has(device.mac)) {
			alerts.push({
				type: 'new_device',
				severity: 'low',
				message: `New device detected: ${device.manufacturer || 'Unknown'} (${device.mac})`,
				timestamp: Date.now() / 1000,
				details: {
					mac: device.mac,
					signal: device.signal?.last_signal,
					channel: device.channel
				},
				id: `alert-${++counter.value}-${Date.now()}`
			});
		}
	}

	return alerts;
}

/**
 * Apply a Kismet data update (devices and/or networks) to the current store state.
 * Generates new-device alerts and caps the alert list to MAX_ALERTS.
 */
function applyDataUpdate(
	state: KismetStore,
	data: KismetDataUpdate,
	counter: AlertCounter
): KismetStore {
	const newState = { ...state };

	if (data.devices) {
		newState.devices = data.devices;
		const newAlerts = createNewDeviceAlerts(state.devices, data.devices, counter);
		if (newAlerts.length > 0) {
			newState.alerts = [...newState.alerts, ...newAlerts].slice(-MAX_ALERTS);
		}
	}

	if (data.networks) {
		newState.networks = data.networks;
	}

	newState.lastUpdate = Date.now();
	return newState;
}

/**
 * Create the Kismet reactive store with device, network, alert, status,
 * and GPS state management. Returns a store-compatible object with
 * subscribe, set, and domain-specific update methods.
 */
function createKismetStore() {
	const store: Writable<KismetStore> = writable(createInitialState());
	const counter: AlertCounter = { value: 0 };

	return {
		subscribe: store.subscribe,
		set: store.set,

		updateDevices: (devices: KismetDevice[]) => {
			store.update((s) => ({ ...s, devices, lastUpdate: Date.now() }));
		},

		updateNetworks: (networks: KismetNetwork[]) => {
			store.update((s) => ({ ...s, networks, lastUpdate: Date.now() }));
		},

		addAlert: (alert: Omit<KismetAlert, 'id'>) => {
			const newAlert: KismetAlert = {
				...alert,
				id: `alert-${++counter.value}-${Date.now()}`
			};
			store.update((s) => ({
				...s,
				alerts: [...s.alerts, newAlert].slice(-MAX_ALERTS)
			}));
		},

		clearAlerts: () => {
			store.update((s) => ({ ...s, alerts: [] }));
		},

		updateStatus: (status: Partial<KismetStatus>) => {
			store.update((s) => computeStatusUpdate(s, status));
		},

		updateGPS: (gps: KismetStore['gps']) => {
			store.update((s) => ({ ...s, gps }));
		},

		getStatus: () => {
			const current = get(store);
			return { ...current.status, startTime: current.startTime };
		},

		processKismetData: (data: KismetDataUpdate) => {
			store.update((s) => applyDataUpdate(s, data, counter));
		}
	};
}

export const kismetStore = createKismetStore();

// Derived stores for filtered data
export const activeDevices = derived(kismetStore, ($store) => {
	const fiveMinutesAgo = Date.now() / 1000 - 300;
	return $store.devices.filter((d) => d.last_seen > fiveMinutesAgo);
});

export const recentAlerts = derived(kismetStore, ($store) => {
	const oneHourAgo = Date.now() / 1000 - 3600;
	return $store.alerts.filter((a) => a.timestamp > oneHourAgo);
});

export const devicesByType = derived(kismetStore, ($store) => {
	const types: Record<string, number> = {};
	$store.devices.forEach((device) => {
		types[device.type] = (types[device.type] || 0) + 1;
	});
	return types;
});

export const channelDistribution = derived(kismetStore, ($store) => {
	const channels: Record<number, number> = {};
	$store.devices.forEach((device) => {
		if (device.channel > 0) {
			channels[device.channel] = (channels[device.channel] || 0) + 1;
		}
	});
	return channels;
});
