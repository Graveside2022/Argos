import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { KismetStore, KismetDevice, KismetNetwork, KismetAlert, KismetStatus } from '$lib/types/kismet';

interface KismetDataUpdate {
	devices?: KismetDevice[];
	networks?: KismetNetwork[];
}

function createKismetStore() {
	const store: Writable<KismetStore> = writable({
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
	});

	let alertIdCounter = 0;

	return {
		subscribe: store.subscribe,
		
		// Update entire store
		set: store.set,
		
		// Update devices
		updateDevices: (devices: KismetDevice[]) => {
			store.update(s => ({
				...s,
				devices,
				lastUpdate: Date.now()
			}));
		},
		
		// Update networks
		updateNetworks: (networks: KismetNetwork[]) => {
			store.update(s => ({
				...s,
				networks,
				lastUpdate: Date.now()
			}));
		},
		
		// Add alert
		addAlert: (alert: Omit<KismetAlert, 'id'>) => {
			const newAlert: KismetAlert = {
				...alert,
				id: `alert-${++alertIdCounter}-${Date.now()}`
			};
			
			store.update(s => ({
				...s,
				alerts: [...s.alerts, newAlert]
			}));
		},
		
		// Clear alerts
		clearAlerts: () => {
			store.update(s => ({
				...s,
				alerts: []
			}));
		},
		
		// Update status
		updateStatus: (status: Partial<KismetStatus>) => {
			store.update(s => {
				const newStatus = { ...s.status, ...status };
				
				// Track start time when Kismet starts
				let startTime = s.startTime;
				if (newStatus.kismet_running && !s.status.kismet_running) {
					startTime = Date.now();
				} else if (!newStatus.kismet_running && s.status.kismet_running) {
					startTime = null;
				}
				
				return {
					...s,
					status: newStatus,
					startTime
				};
			});
		},
		
		// Update GPS
		updateGPS: (gps: KismetStore['gps']) => {
			store.update(s => ({
				...s,
				gps
			}));
		},
		
		// Get current status
		getStatus: () => {
			const current = get(store);
			return {
				...current.status,
				startTime: current.startTime
			};
		},
		
		// Process Kismet data update
		processKismetData: (data: KismetDataUpdate) => {
			store.update(s => {
				const newState = { ...s };
				
				// Process devices
				if (data.devices) {
					newState.devices = data.devices;
					
					// Check for new devices and create alerts
					const existingMacs = new Set(s.devices.map(d => d.mac));
					data.devices.forEach((device) => {
						if (!existingMacs.has(device.mac)) {
							// New device detected
							const alert: Omit<KismetAlert, 'id'> = {
								type: 'new_device',
								severity: 'low',
								message: `New device detected: ${device.manufacturer || 'Unknown'} (${device.mac})`,
								timestamp: Date.now() / 1000,
								details: {
									mac: device.mac,
									signal: device.signal?.last_signal,
									channel: device.channel
								}
							};
							newState.alerts = [...newState.alerts, {
								...alert,
								id: `alert-${++alertIdCounter}-${Date.now()}`
							}];
						}
					});
				}
				
				// Process networks
				if (data.networks) {
					newState.networks = data.networks;
				}
				
				// Update last update time
				newState.lastUpdate = Date.now();
				
				return newState;
			});
		}
	};
}

export const kismetStore = createKismetStore();

// Derived stores for filtered data
export const activeDevices = derived(kismetStore, $store => {
	const fiveMinutesAgo = Date.now() / 1000 - 300;
	return $store.devices.filter(d => d.last_seen > fiveMinutesAgo);
});

export const recentAlerts = derived(kismetStore, $store => {
	const oneHourAgo = Date.now() / 1000 - 3600;
	return $store.alerts.filter(a => a.timestamp > oneHourAgo);
});

export const devicesByType = derived(kismetStore, $store => {
	const types: Record<string, number> = {};
	$store.devices.forEach(device => {
		types[device.type] = (types[device.type] || 0) + 1;
	});
	return types;
});

export const channelDistribution = derived(kismetStore, $store => {
	const channels: Record<number, number> = {};
	$store.devices.forEach(device => {
		if (device.channel > 0) {
			channels[device.channel] = (channels[device.channel] || 0) + 1;
		}
	});
	return channels;
});