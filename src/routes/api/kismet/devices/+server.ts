import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { fusionKismetController } from '$lib/server/kismet/fusion_controller';
import { KismetService } from '$lib/server/services';

/**
 * Fetch current GPS position for fallback when devices lack their own location.
 */
async function getReceiverGPS(fetchFn: typeof fetch): Promise<{ lat: number; lon: number } | null> {
	try {
		const resp = await fetchFn('/api/gps/position');
		if (resp.ok) {
			const body = (await resp.json()) as Record<string, unknown>;
			if (body.success && body.data) {
				const d = body.data as Record<string, number>;
				if (d.latitude && d.longitude && !(d.latitude === 0 && d.longitude === 0)) {
					return { lat: d.latitude, lon: d.longitude };
				}
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

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		// Try to get devices from the new Kismet controller if available
		if (fusionKismetController.isReady()) {
			const [devices, gps] = await Promise.all([
				fusionKismetController.getDevices(),
				getReceiverGPS(fetch)
			]);
			const status = fusionKismetController.getStatus();

			return json({
				devices: normalizeFusionDevices((devices || []) as Record<string, unknown>[], gps),
				source: 'kismet' as const,
				status: {
					running: status.running,
					deviceCount: status.deviceCount,
					interface: status.interface,
					uptime: status.uptime
				}
			});
		}

		// Fallback to existing service implementation (GPS fallback handled inside KismetService)
		const response = await KismetService.getDevices(fetch);
		return json(response);
	} catch (error: unknown) {
		console.error('Error in Kismet devices endpoint:', error);

		// Fallback to existing service implementation on error
		try {
			const response = await KismetService.getDevices(fetch);
			return json(response);
		} catch {
			return json({
				devices: [],
				error: (error as { message?: string }).message || 'Unknown error',
				source: 'fallback' as const
			});
		}
	}
};
