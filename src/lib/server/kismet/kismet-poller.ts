// Kismet API polling logic extracted from WebSocketManager
//
// Fetches device and status data from the Kismet REST API on a timer,
// transforms raw responses, and pushes updates to the WebSocketManager.

import { KismetRawDeviceSchema, KismetSystemStatusSchema } from '$lib/schemas/rf';
import { logError } from '$lib/utils/logger';

import type { KismetRawDevice } from './kismet-device-transform';
import { hasDeviceChanged, transformRawDevice } from './kismet-device-transform';
import type { KismetDevice, WebSocketMessage } from './types';

interface CachedDevice {
	device: KismetDevice;
	lastUpdate: number;
}

/** Broadcast callback type — the manager injects its broadcast method */
type BroadcastFn = (
	message: WebSocketMessage,
	filter?: (sub: { types: Set<string> }) => boolean
) => void;

export interface PollerState {
	deviceCache: Map<string, CachedDevice>;
	updateThrottles: Map<string, number>;
	lastPollTime: number;
	isPolling: boolean;
	statsThrottle: number;
}

/**
 * Poll Kismet for device updates. Mutates the pollerState in place.
 */
export async function pollKismetDevices(
	state: PollerState,
	clientCount: number,
	apiUrl: string,
	apiKey: string,
	throttleInterval: number,
	broadcast: BroadcastFn
): Promise<void> {
	if (state.isPolling || clientCount === 0) return;

	state.isPolling = true;
	const startTime = Date.now();

	try {
		const response = await fetch(
			`${apiUrl}/devices/last-time/${state.lastPollTime}/devices.json`,
			{ headers: { KISMET: apiKey } }
		);

		if (!response.ok) throw new Error(`Kismet API error: ${response.status}`);

		// Defensive validation: External Kismet API may return unexpected data
		const rawDevices = await response.json();
		const devices = Array.isArray(rawDevices)
			? rawDevices
					.map((d: unknown) => {
						const result = KismetRawDeviceSchema.safeParse(d);
						return result.success ? result.data : null;
					})
					.filter((d): d is NonNullable<typeof d> => d !== null)
			: [];

		for (const raw of devices) {
			processDeviceUpdate(raw, state, throttleInterval, broadcast);
		}

		state.lastPollTime = Math.floor(startTime / 1000);

		if (Date.now() - state.statsThrottle > throttleInterval) {
			void fetchAndEmitSystemStatus(state, apiUrl, apiKey, broadcast);
			state.statsThrottle = Date.now();
		}
	} catch (error) {
		logError('Error polling Kismet:', { error });
		broadcast({
			type: 'error',
			data: { error: 'Failed to poll Kismet data', timestamp: new Date().toISOString() },
			timestamp: new Date().toISOString()
		});
	} finally {
		state.isPolling = false;
	}
}

/** Process a single device update from Kismet */
function processDeviceUpdate(
	kismetDevice: KismetRawDevice,
	state: PollerState,
	throttleInterval: number,
	broadcast: BroadcastFn
): void {
	const device = transformRawDevice(kismetDevice);
	if (!device) return;

	const deviceKey = kismetDevice['kismet.device.base.key'];
	const cached = state.deviceCache.get(deviceKey);
	const changed = !cached || hasDeviceChanged(cached.device, device);

	if (changed) {
		state.deviceCache.set(deviceKey, { device, lastUpdate: Date.now() });

		const lastEmit = state.updateThrottles.get(deviceKey) || 0;
		if (Date.now() - lastEmit > throttleInterval) {
			emitDeviceUpdate(device, broadcast);
			state.updateThrottles.set(deviceKey, Date.now());
		}
	}
}

/** Emit a device update to subscribed clients */
function emitDeviceUpdate(device: KismetDevice, broadcast: BroadcastFn): void {
	const message: WebSocketMessage = {
		type: 'device_update',
		// Safe: KismetDevice cast to Record for WebSocketMessage data field
		data: device as unknown as Record<string, unknown>,
		timestamp: new Date().toISOString()
	};

	broadcast(message, (sub) => {
		if (!sub.types.has('device_update') && !sub.types.has('*')) return false;
		return true;
	});
}

/** Fetch and emit Kismet system status */
async function fetchAndEmitSystemStatus(
	state: PollerState,
	apiUrl: string,
	apiKey: string,
	broadcast: BroadcastFn
): Promise<void> {
	try {
		const response = await fetch(`${apiUrl}/system/status.json`, {
			headers: { KISMET: apiKey }
		});

		if (!response.ok) throw new Error(`Failed to get system status: ${response.status}`);

		const rawStatus = await response.json();
		const statusResult = KismetSystemStatusSchema.safeParse(rawStatus);
		if (!statusResult.success) {
			logError('Invalid Kismet system status response', { error: statusResult.error });
			return;
		}
		const status = statusResult.data;
		const message: WebSocketMessage = {
			type: 'status_change',
			data: {
				devices_count: state.deviceCache.size,
				packets_rate: status['kismet.system.packets.rate'] || 0,
				memory_usage: status['kismet.system.memory.rss'] || 0,
				cpu_usage: status['kismet.system.cpu.system'] || 0,
				uptime: status['kismet.system.timestamp.start_sec']
					? Date.now() - status['kismet.system.timestamp.start_sec'] * 1000
					: 0,
				channels: status['kismet.system.channels.channels'] || [],
				interfaces: status['kismet.system.interfaces'] || []
			},
			timestamp: new Date().toISOString()
		};

		broadcast(message, (sub) => sub.types.has('status_change') || sub.types.has('*'));
	} catch (error) {
		logError('Error emitting system status:', { error });
	}
}
