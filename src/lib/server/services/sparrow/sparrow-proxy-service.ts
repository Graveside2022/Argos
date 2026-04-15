/**
 * Sparrow-WiFi agent API proxy service.
 * Typed fetch wrappers for the sparrowwifiagent.py REST API (port 8020).
 * Each function fetches from localhost and returns typed results.
 */

import { env } from '$lib/server/env';
import type {
	SparrowBluetoothDevice,
	SparrowGpsPosition,
	SparrowNetwork
} from '$lib/types/sparrow';
import { logger } from '$lib/utils/logger';

const BASE_URL = `http://localhost:${env.SPARROW_PORT}`;
const FETCH_TIMEOUT = 5000;

/** Fetch from the Sparrow agent with timeout and error handling */
async function sparrowFetch(path: string): Promise<Response> {
	const url = `${BASE_URL}${path}`;
	const response = await fetch(url, {
		signal: AbortSignal.timeout(FETCH_TIMEOUT)
	});
	if (!response.ok) {
		throw new Error(`Sparrow agent returned ${response.status} for ${path}`);
	}
	return response;
}

/** Parse JSON response, returning empty fallback on error */
async function sparrowJson<T>(path: string, fallback: T): Promise<T> {
	try {
		const response = await sparrowFetch(path);
		return (await response.json()) as T;
	} catch (error) {
		logger.warn(`[sparrow-proxy] Failed to fetch ${path}`, { error });
		return fallback;
	}
}

/** GET /wireless/interfaces — list available WiFi interfaces.
 *  Filters out wlan0 which is reserved for internet connectivity. */
export async function getWirelessInterfaces(): Promise<string[]> {
	const data = await sparrowJson<Record<string, unknown>>('/wireless/interfaces', {
		interfaces: []
	});
	const ifaces = data.interfaces;
	if (!Array.isArray(ifaces)) return [];
	return (ifaces as string[]).filter((iface) => iface !== 'wlan0');
}

/** GET /wireless/networks/<interface> — scan results for a WiFi interface */
export async function scanNetworks(iface: string): Promise<SparrowNetwork[]> {
	const data = await sparrowJson<Record<string, unknown>>(
		`/wireless/networks/${encodeURIComponent(iface)}`,
		{ networks: [] }
	);
	const networks = data.networks;
	return Array.isArray(networks) ? (networks as SparrowNetwork[]) : [];
}

/** GET /bluetooth/present — check if Bluetooth adapter is available */
export async function getBluetoothPresent(): Promise<boolean> {
	const data = await sparrowJson<Record<string, unknown>>('/bluetooth/present', {
		present: false
	});
	return data.present === true;
}

/** GET /bluetooth/scanstart — start BLE scanning */
export async function startBluetoothScan(): Promise<boolean> {
	try {
		await sparrowFetch('/bluetooth/scanstart');
		return true;
	} catch {
		return false;
	}
}

/** GET /bluetooth/scanstop — stop BLE scanning */
export async function stopBluetoothScan(): Promise<boolean> {
	try {
		await sparrowFetch('/bluetooth/scanstop');
		return true;
	} catch {
		return false;
	}
}

/** GET /bluetooth/scanstatus — get current BT scan results */
export async function getBluetoothDevices(): Promise<SparrowBluetoothDevice[]> {
	const data = await sparrowJson<Record<string, unknown>>('/bluetooth/scanstatus', {
		devices: []
	});
	const devices = data.devices;
	return Array.isArray(devices) ? (devices as SparrowBluetoothDevice[]) : [];
}

/** GET /bluetooth/running — check if BT scan is active */
export async function isBluetoothScanRunning(): Promise<boolean> {
	const data = await sparrowJson<Record<string, unknown>>('/bluetooth/running', {
		running: false
	});
	return data.running === true;
}

/** Parse a gpspos object into a typed position, or null if invalid. */
function parseGpsPosition(gpspos: Record<string, unknown>): SparrowGpsPosition | null {
	if (typeof gpspos.latitude !== 'number' || typeof gpspos.longitude !== 'number') return null;
	return {
		latitude: gpspos.latitude,
		longitude: gpspos.longitude,
		altitude: (gpspos.altitude as number) ?? 0,
		speed: (gpspos.speed as number) ?? 0
	};
}

/** GET /gps/status — get current GPS position */
export async function getGpsStatus(): Promise<SparrowGpsPosition | null> {
	const data = await sparrowJson<Record<string, unknown>>('/gps/status', {});
	const gpspos = data.gpspos as Record<string, unknown> | undefined;
	return gpspos ? parseGpsPosition(gpspos) : null;
}

/** GET /spectrum/hackrfstatus — check if HackRF is available */
export async function getHackrfStatus(): Promise<boolean> {
	const data = await sparrowJson<Record<string, unknown>>('/spectrum/hackrfstatus', {
		hackrfavailable: false
	});
	return data.hackrfavailable === true;
}
