/**
 * Kismet WebSocket message handlers — device, network, alert, GPS, and status processing.
 * Extracted from websocket.ts to comply with Article 2.2 (max 300 lines/file).
 */

import { get } from 'svelte/store';

import { kismetStore } from '$lib/kismet/stores';
import type {
	KismetAlert,
	KismetDevice,
	KismetGPS,
	KismetNetwork,
	KismetStatus
} from '$lib/kismet/types';
import { logger } from '$lib/utils/logger';

/** Handle Kismet status updates */
export function handleStatusUpdate(status: unknown): void {
	if (!status || typeof status !== 'object' || status === null) return;

	const partialStatus: Partial<KismetStatus> = {};
	// Safe: Type cast for dynamic access
	const statusObj = status as Record<string, unknown>;

	const kismetRunning = statusObj.kismet_running;
	if (typeof kismetRunning === 'boolean') {
		partialStatus.kismet_running = kismetRunning;
	}

	const wigleRunning = statusObj.wigle_running;
	if (typeof wigleRunning === 'boolean') {
		partialStatus.wigle_running = wigleRunning;
	}

	const gpsRunning = statusObj.gps_running;
	if (typeof gpsRunning === 'boolean') {
		partialStatus.gps_running = gpsRunning;
	}

	kismetStore.updateStatus(partialStatus);
}

/** Handle device update */
export function handleDeviceUpdate(device: unknown): void {
	if (!device || typeof device !== 'object' || device === null) return;

	// Safe: Type cast for dynamic access
	const deviceObj = device as Record<string, unknown>;
	if (!('mac' in deviceObj) || typeof deviceObj.mac !== 'string') return;

	const store = get(kismetStore);
	const devices = [...store.devices];
	const index = devices.findIndex((d) => d.mac === deviceObj.mac);

	// Safe: Cast to KismetDevice after mac field validated above
	const kismetDevice = device as KismetDevice;
	if (index >= 0) {
		devices[index] = { ...devices[index], ...kismetDevice };
	} else {
		devices.push(kismetDevice);
	}

	kismetStore.updateDevices(devices);
}

/** Handle new device detection */
export function handleNewDevice(device: unknown): void {
	if (!device || typeof device !== 'object' || device === null) return;

	// Safe: Type cast for dynamic access
	const deviceObj = device as Record<string, unknown>;
	if (!('mac' in deviceObj) || typeof deviceObj.mac !== 'string') return;

	// Safe: Cast to KismetDevice after mac field validated above
	const kismetDevice = device as KismetDevice;
	const store = get(kismetStore);
	const devices = [...store.devices, kismetDevice];
	kismetStore.updateDevices(devices);

	const deviceName =
		deviceObj.last_ssid !== null &&
		deviceObj.last_ssid !== undefined &&
		typeof deviceObj.last_ssid === 'string'
			? deviceObj.last_ssid
			: String(deviceObj.mac);

	kismetStore.addAlert({
		type: 'new_device',
		severity: 'low',
		message: `New device detected: ${deviceName}`,
		timestamp: Date.now() / 1000
	});
}

/** Handle device removal */
export function handleDeviceRemoved(data: unknown): void {
	if (!data || typeof data !== 'object' || data === null) return;

	// Safe: Type cast for dynamic access
	const dataObj = data as Record<string, unknown>;
	if (!('mac' in dataObj) || typeof dataObj.mac !== 'string') return;

	const store = get(kismetStore);
	const devices = store.devices.filter((d) => d.mac !== dataObj.mac);
	kismetStore.updateDevices(devices);
}

/** Handle full devices list */
export function handleDevicesList(data: unknown): void {
	if (!data || typeof data !== 'object' || data === null) return;

	// Safe: Type cast for dynamic access
	const dataObj = data as Record<string, unknown>;
	if (!('devices' in dataObj) || !Array.isArray(dataObj.devices)) return;

	// Safe: Array.isArray check above confirms array type
	const devices = dataObj.devices as unknown[];
	const validDevices = devices.filter(
		(device): device is KismetDevice =>
			device !== null && typeof device === 'object' && 'mac' in device
	);

	kismetStore.updateDevices(validDevices);
}

/** Handle network update */
export function handleNetworkUpdate(network: unknown): void {
	if (!network || typeof network !== 'object' || network === null) return;

	// Safe: Type cast for dynamic access
	const networkObj = network as Record<string, unknown>;
	if (!('ssid' in networkObj) || typeof networkObj.ssid !== 'string') return;

	const store = get(kismetStore);
	const networks = [...store.networks];
	const index = networks.findIndex((n) => n.ssid === networkObj.ssid);

	// Safe: Cast to KismetNetwork after ssid field validated above
	const kismetNetwork = network as KismetNetwork;
	if (index >= 0) {
		networks[index] = { ...networks[index], ...kismetNetwork };
	} else {
		networks.push(kismetNetwork);
	}

	kismetStore.updateNetworks(networks);
}

/** Handle full networks list */
export function handleNetworksList(data: unknown): void {
	if (!data || typeof data !== 'object' || data === null) return;

	// Safe: Type cast for dynamic access
	const dataObj = data as Record<string, unknown>;
	if (!('networks' in dataObj) || !Array.isArray(dataObj.networks)) return;

	// Safe: Array.isArray check above confirms array type
	const networks = dataObj.networks as unknown[];
	const validNetworks = networks.filter(
		(network): network is KismetNetwork =>
			network !== null && typeof network === 'object' && 'ssid' in network
	);

	kismetStore.updateNetworks(validNetworks);
}

/** Handle alert messages */
export function handleAlert(alert: unknown): void {
	if (!alert || typeof alert !== 'object' || alert === null) return;

	// Safe: Type cast for dynamic access
	const alertObj = alert as Record<string, unknown>;
	const message =
		'message' in alertObj && typeof alertObj.message === 'string'
			? alertObj.message
			: 'Unknown alert';

	let severity: 'low' | 'medium' | 'high' = 'low';
	if ('severity' in alertObj && typeof alertObj.severity === 'string') {
		const sev = alertObj.severity;
		if (sev === 'low' || sev === 'medium' || sev === 'high') {
			severity = sev;
		}
	}

	const timestamp =
		'timestamp' in alertObj && typeof alertObj.timestamp === 'number'
			? alertObj.timestamp
			: Date.now() / 1000;

	let alertType: KismetAlert['type'] = 'info';
	if ('type' in alertObj && typeof alertObj.type === 'string') {
		const type = alertObj.type;
		if (
			type === 'new_device' ||
			type === 'security' ||
			type === 'deauth' ||
			type === 'probe' ||
			type === 'handshake' ||
			type === 'suspicious' ||
			type === 'info'
		) {
			alertType = type;
		}
	}

	kismetStore.addAlert({
		type: alertType,
		severity,
		message,
		timestamp
	});
}

/** Handle GPS position updates */
export function handleGpsUpdate(gps: unknown): void {
	if (!gps || typeof gps !== 'object' || gps === null) return;

	// Safe: Type cast for dynamic access
	const gpsObj = gps as Record<string, unknown>;

	const gpsData: KismetGPS = {
		status: typeof gpsObj.status === 'string' ? gpsObj.status : 'No Fix',
		lat: typeof gpsObj.lat === 'string' ? gpsObj.lat : 'N/A',
		lon: typeof gpsObj.lon === 'string' ? gpsObj.lon : 'N/A',
		alt: typeof gpsObj.alt === 'string' ? gpsObj.alt : 'N/A',
		time: typeof gpsObj.time === 'string' ? gpsObj.time : 'N/A'
	};

	kismetStore.updateGPS(gpsData);
}

/** Handle error messages */
export function handleErrorMessage(error: unknown): void {
	logger.error('[Kismet] Server error', { error });

	const errorMessage =
		error && typeof error === 'object' && 'message' in error
			? // Safe: 'message' in error check above guarantees property exists
				// @constitutional-exemption Article-II-2.1 issue:#14 — WebSocket error type narrowing
				(error as { message: string }).message
			: 'Unknown server error';

	kismetStore.addAlert({
		type: 'security',
		severity: 'high',
		message: errorMessage,
		timestamp: Date.now() / 1000
	});
}
