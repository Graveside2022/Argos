import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { hasValidGpsCoords } from '$lib/server/db/geo';
import { fusionKismetController } from '$lib/server/kismet/fusion-controller';
import { getGpsPosition } from '$lib/server/services/gps/gps-position-service';
import { KismetService } from '$lib/server/services/kismet.service';
import { computeFallbackLocation } from '$lib/server/services/kismet/kismet-geo-helpers';
import { logger } from '$lib/utils/logger';

/** Extract valid GPS coordinates from position data, or null. */
function extractGpsCoords(data: {
	latitude: number | null;
	longitude: number | null;
}): { lat: number; lon: number } | null {
	const lat = data.latitude ?? 0;
	const lon = data.longitude ?? 0;
	return hasValidGpsCoords(lat, lon) ? { lat, lon } : null;
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
	if (hasValidGpsCoords(coords.lat, coords.lon) || !gps) return coords;
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

export const GET = createHandler(async () => {
	try {
		if (fusionKismetController.isReady()) return await fetchFusionDevices();
		return await KismetService.getDevices();
	} catch (error: unknown) {
		logger.error('Error in Kismet devices endpoint', { error: errMsg(error) });
		return await fetchKismetFallback();
	}
});
