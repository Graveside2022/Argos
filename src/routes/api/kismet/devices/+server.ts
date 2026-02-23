import { json } from '@sveltejs/kit';

import { fusionKismetController } from '$lib/server/kismet/fusion-controller';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { KismetService } from '$lib/server/services/kismet.service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * Fetch current GPS position for fallback when devices lack their own location.
 * Calls the GPS service directly instead of HTTP fetch to avoid auth gate blocking.
 */
/** Extract valid GPS coordinates from position data, or null. */
function extractGpsCoords(data: {
	latitude: number | null;
	longitude: number | null;
}): { lat: number; lon: number } | null {
	const lat = data.latitude ?? 0;
	const lon = data.longitude ?? 0;
	return lat !== 0 || lon !== 0 ? { lat, lon } : null;
}

async function getReceiverGPS(): Promise<{ lat: number; lon: number } | null> {
	try {
		const position = await getGpsPosition();
		if (!position.success || !position.data) return null;
		return extractGpsCoords(position.data);
	} catch {
		return null;
	}
}

/** FNV-1a 32-bit hash → [0, 1) */
function hashMAC(mac: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x01000193) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/** Second independent hash (different seed) → [0, 1) */
function hashMAC2(mac: string): number {
	let hash = 0x01000193;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x811c9dc5) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/**
 * Normalize fusion controller WiFiDevice[] to frontend-expected format (lat/lon)
 * and apply deterministic, signal-aware GPS fallback for devices without valid coordinates.
 */
/** Extract device MAC address from various property names. */
function extractMac(d: Record<string, unknown>): string {
	return (d.mac as string) || (d.macaddr as string) || '';
}

/** Extract signal dBm from various device property structures. */
function extractSignalDbm(d: Record<string, unknown>): number {
	const sig = d.signalStrength as number | undefined;
	const sigObj = d.signal as Record<string, number> | undefined;
	return sig ?? sigObj?.last_signal ?? -80;
}

/** Compute fallback lat/lon from GPS base + MAC hash + signal distance. */
function computeFallbackLocation(
	gps: { lat: number; lon: number },
	mac: string,
	signalDbm: number
): { lat: number; lon: number } {
	const angle = hashMAC(mac) * 2 * Math.PI;
	const clamped = Math.max(-100, Math.min(-20, Math.round(signalDbm / 10) * 10));
	const signalNorm = (clamped + 100) / 80;
	const baseDist = 20 + (1 - signalNorm) * 180;
	const dist = baseDist * (0.85 + hashMAC2(mac) * 0.3);

	const R = 6371000;
	const lat = gps.lat + ((dist * Math.cos(angle)) / R) * (180 / Math.PI);
	const lon =
		gps.lon +
		((dist * Math.sin(angle)) / (R * Math.cos((gps.lat * Math.PI) / 180))) * (180 / Math.PI);
	return { lat, lon };
}

/** Read a numeric coordinate from a location object, checking two possible keys. */
function readCoord(loc: Record<string, number> | undefined, key1: string, key2: string): number {
	return loc?.[key1] ?? loc?.[key2] ?? 0;
}

/** Extract lat/lon from device location object. */
function extractDeviceCoords(d: Record<string, unknown>): { lat: number; lon: number } {
	const loc = d.location as Record<string, number> | undefined;
	return { lat: readCoord(loc, 'latitude', 'lat'), lon: readCoord(loc, 'longitude', 'lon') };
}

/** Extract device location or compute fallback. */
function resolveDeviceLocation(
	d: Record<string, unknown>,
	gps: { lat: number; lon: number } | null
): { lat: number; lon: number } {
	const coords = extractDeviceCoords(d);
	if (coords.lat !== 0 || coords.lon !== 0 || !gps) return coords;
	return computeFallbackLocation(gps, extractMac(d), extractSignalDbm(d));
}

function normalizeFusionDevices(
	devices: Record<string, unknown>[],
	gps: { lat: number; lon: number } | null
): Record<string, unknown>[] {
	return devices.map((d) => ({ ...d, location: resolveDeviceLocation(d, gps) }));
}

/** Fetch devices via fusion controller with GPS normalization. */
async function fetchFusionDevices(): Promise<Record<string, unknown>> {
	const [devices, gps] = await Promise.all([
		fusionKismetController.getDevices(),
		getReceiverGPS()
	]);
	const status = await fusionKismetController.getStatus();
	return {
		devices: normalizeFusionDevices(
			(devices || []) as unknown as Record<string, unknown>[],
			gps
		),
		source: 'kismet' as const,
		status: {
			isRunning: status.isRunning,
			deviceCount: status.deviceCount,
			interface: status.interface,
			uptime: status.uptime
		}
	};
}

/** Fallback to KismetService, returning error payload on failure. */
async function fetchKismetFallback(): Promise<unknown> {
	try {
		return await KismetService.getDevices();
	} catch (fallbackError: unknown) {
		return {
			devices: [],
			error: (fallbackError as { message?: string }).message || 'Unknown error',
			source: 'fallback' as const
		};
	}
}

export const GET: RequestHandler = async () => {
	try {
		if (fusionKismetController.isReady()) return json(await fetchFusionDevices());
		return json(await KismetService.getDevices());
	} catch (error: unknown) {
		logger.error('Error in Kismet devices endpoint', { error: (error as Error).message });
		return json(await fetchKismetFallback());
	}
};
