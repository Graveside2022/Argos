// Kismet API polling logic extracted from WebSocketManager
//
// Fetches device and status data from the Kismet REST API on a timer,
// transforms raw responses, and pushes updates to the WebSocketManager.

import { KismetRawDeviceSchema, KismetSystemStatusSchema } from '$lib/schemas/rf';
import { logger } from '$lib/utils/logger';

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

/** Parse and validate raw device data from Kismet API */
function validateRawDevices(rawDevices: unknown): KismetRawDevice[] {
	if (!Array.isArray(rawDevices)) return [];
	return rawDevices
		.map((d: unknown) => {
			const result = KismetRawDeviceSchema.safeParse(d);
			return result.success ? result.data : null;
		})
		.filter((d): d is NonNullable<typeof d> => d !== null);
}

/** Fetch devices from Kismet last-time API */
async function fetchDevices(
	apiUrl: string,
	apiKey: string,
	lastPollTime: number
): Promise<KismetRawDevice[]> {
	const response = await fetch(`${apiUrl}/devices/last-time/${lastPollTime}/devices.json`, {
		headers: { KISMET: apiKey }
	});
	if (!response.ok) throw new Error(`Kismet API error: ${response.status}`);
	return validateRawDevices(await response.json());
}

/** Emit an error broadcast when polling fails */
function broadcastPollError(broadcast: BroadcastFn, error: unknown): void {
	logger.error('Error polling Kismet:', { error });
	broadcast({
		type: 'error',
		data: { error: 'Failed to poll Kismet data', timestamp: new Date().toISOString() },
		timestamp: new Date().toISOString()
	});
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
		const devices = await fetchDevices(apiUrl, apiKey, state.lastPollTime);
		for (const raw of devices) {
			processDeviceUpdate(raw, state, throttleInterval, broadcast);
		}
		state.lastPollTime = Math.floor(startTime / 1000);
		maybeEmitStatus(state, apiUrl, apiKey, throttleInterval, broadcast);
	} catch (error) {
		broadcastPollError(broadcast, error);
	} finally {
		state.isPolling = false;
	}
}

/** Emit system status if enough time has passed since the last emission */
function maybeEmitStatus(
	state: PollerState,
	apiUrl: string,
	apiKey: string,
	throttleInterval: number,
	broadcast: BroadcastFn
): void {
	if (Date.now() - state.statsThrottle <= throttleInterval) return;
	void fetchAndEmitSystemStatus(state, apiUrl, apiKey, broadcast);
	state.statsThrottle = Date.now();
}

/** Check if a device update should be emitted based on throttle */
function shouldEmitUpdate(
	state: PollerState,
	deviceKey: string,
	throttleInterval: number
): boolean {
	const lastEmit = state.updateThrottles.get(deviceKey) || 0;
	return Date.now() - lastEmit > throttleInterval;
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
	if (cached && !hasDeviceChanged(cached.device, device)) return;

	state.deviceCache.set(deviceKey, { device, lastUpdate: Date.now() });
	if (shouldEmitUpdate(state, deviceKey, throttleInterval)) {
		emitDeviceUpdate(device, broadcast);
		state.updateThrottles.set(deviceKey, Date.now());
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

/** Compute uptime from Kismet start timestamp */
function computeUptime(status: Record<string, unknown>): number {
	const startSec = status['kismet.system.timestamp.start_sec'];
	return typeof startSec === 'number' ? Date.now() - startSec * 1000 : 0;
}

/** Read a status field with a fallback default */
function statusField(status: Record<string, unknown>, key: string, fallback: unknown): unknown {
	return status[key] || fallback;
}

/** Extract system resource metrics from status */
function extractStatusMetrics(
	status: Record<string, unknown>
): Pick<Record<string, unknown>, string> {
	return {
		packets_rate: statusField(status, 'kismet.system.packets.rate', 0),
		memory_usage: statusField(status, 'kismet.system.memory.rss', 0),
		cpu_usage: statusField(status, 'kismet.system.cpu.system', 0),
		channels: statusField(status, 'kismet.system.channels.channels', []),
		interfaces: statusField(status, 'kismet.system.interfaces', [])
	};
}

/** Build status message data from validated Kismet system status */
function buildStatusData(
	status: Record<string, unknown>,
	deviceCount: number
): Record<string, unknown> {
	return {
		devices_count: deviceCount,
		...extractStatusMetrics(status),
		uptime: computeUptime(status)
	};
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

		const statusResult = KismetSystemStatusSchema.safeParse(await response.json());
		if (!statusResult.success) {
			logger.error('Invalid Kismet system status response', { error: statusResult.error });
			return;
		}

		const message: WebSocketMessage = {
			type: 'status_change',
			data: buildStatusData(statusResult.data, state.deviceCache.size),
			timestamp: new Date().toISOString()
		};
		broadcast(message, (sub) => sub.types.has('status_change') || sub.types.has('*'));
	} catch (error) {
		logger.error('Error emitting system status:', { error });
	}
}
