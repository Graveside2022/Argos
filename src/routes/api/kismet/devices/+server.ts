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
async function getReceiverGPS(): Promise<{ lat: number; lon: number } | null> {
	try {
		const position = await getGpsPosition();
		if (position.success && position.data) {
			const { latitude, longitude } = position.data;
			if (latitude && longitude && !(latitude === 0 && longitude === 0)) {
				return { lat: latitude, lon: longitude };
			}
		}
	} catch {
		/* GPS unavailable — non-fatal */
	}
	return null;
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
function normalizeFusionDevices(
	devices: Record<string, unknown>[],
	gps: { lat: number; lon: number } | null
): Record<string, unknown>[] {
	return devices.map((d) => {
		// Safe: Device location property may be Record with lat/lon coordinates or undefined
		const loc = d.location as Record<string, number> | undefined;
		let lat = loc?.latitude ?? loc?.lat ?? 0;
		let lon = loc?.longitude ?? loc?.lon ?? 0;

		if (lat === 0 && lon === 0 && gps) {
			const mac = (d.mac as string) || (d.macaddr as string) || '';
			const sig = d.signalStrength as number | undefined;
			const sigObj = d.signal as Record<string, number> | undefined;
			const signalDbm = sig ?? sigObj?.last_signal ?? -80;

			const angle = hashMAC(mac) * 2 * Math.PI;
			const quantized = Math.round(signalDbm / 10) * 10;
			const clamped = Math.max(-100, Math.min(-20, quantized));
			const signalNorm = (clamped + 100) / 80;
			const minDist = 20;
			const maxDist = 200;
			const variation = hashMAC2(mac) * 0.3;
			const baseDist = minDist + (1 - signalNorm) * (maxDist - minDist);
			const dist = baseDist * (0.85 + variation);

			const R = 6371000;
			lat = gps.lat + ((dist * Math.cos(angle)) / R) * (180 / Math.PI);
			lon =
				gps.lon +
				((dist * Math.sin(angle)) / (R * Math.cos((gps.lat * Math.PI) / 180))) *
					(180 / Math.PI);
		}

		return {
			...d,
			location: { lat, lon }
		};
	});
}

export const GET: RequestHandler = async () => {
	try {
		// Try to get devices from the new Kismet controller if available
		if (fusionKismetController.isReady()) {
			const [devices, gps] = await Promise.all([
				fusionKismetController.getDevices(),
				getReceiverGPS()
			]);
			const status = await fusionKismetController.getStatus();

			return json({
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
			});
		}

		// Fallback to existing service implementation (GPS fallback handled inside KismetService)
		const response = await KismetService.getDevices();
		return json(response);
	} catch (error: unknown) {
		logger.error('Error in Kismet devices endpoint', { error: (error as Error).message });

		// Fallback to existing service implementation on error
		try {
			const response = await KismetService.getDevices();
			return json(response);
		} catch (fallbackError: unknown) {
			return json({
				devices: [],
				error: (fallbackError as { message?: string }).message || 'Unknown error',
				source: 'fallback' as const
			});
		}
	}
};
