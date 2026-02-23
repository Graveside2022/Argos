/**
 * GPS position response construction helpers.
 * Builds GpsPositionResponse objects for different GPS states (fix, no-fix, error).
 */

import type { TPVData } from './gps-data-parser';
import type { GpsPositionResponse } from './gps-position-service';

/** Null position data shared by no-fix and error responses */
function buildEmptyPositionData(
	satelliteCount: number | null,
	fix: number,
	time: string | null
): GpsPositionResponse['data'] {
	return {
		latitude: null,
		longitude: null,
		altitude: null,
		speed: null,
		heading: null,
		accuracy: null,
		satellites: satelliteCount,
		fix,
		time
	};
}

/** Extract accuracy from TPV data (prefer epx, fallback to epy, default 10) */
function extractAccuracy(tpvData: TPVData): number {
	return tpvData.epx ?? tpvData.epy ?? 10;
}

/** Coalesce an optional number/string to null */
function orNull<T>(val: T | undefined): T | null {
	return val ?? null;
}

/** Build position data fields from TPV data */
function buildPositionData(tpvData: TPVData, satelliteCount: number): GpsPositionResponse['data'] {
	return {
		latitude: orNull(tpvData.lat),
		longitude: orNull(tpvData.lon),
		altitude: orNull(tpvData.alt),
		speed: orNull(tpvData.speed),
		heading: orNull(tpvData.track),
		accuracy: extractAccuracy(tpvData),
		satellites: satelliteCount,
		fix: tpvData.mode,
		time: orNull(tpvData.time)
	};
}

/** Build a successful GPS fix response with position data */
export function buildFixedPositionResponse(
	tpvData: TPVData,
	satelliteCount: number
): GpsPositionResponse {
	return { success: true, data: buildPositionData(tpvData, satelliteCount) };
}

/** Build a no-fix response (TPV data exists but mode < 2) */
export function buildNoFixResponse(
	tpvData: TPVData,
	satelliteCount: number,
	error?: string
): GpsPositionResponse {
	return {
		success: false,
		error: error || 'No GPS fix available',
		data: buildEmptyPositionData(satelliteCount, tpvData.mode, tpvData.time ?? null),
		mode: tpvData.mode
	};
}

/** Build an error response when no TPV data is available */
export function buildNoDataResponse(error?: string, details?: string): GpsPositionResponse {
	return {
		success: false,
		error: error || 'GPS service not available. Make sure gpsd is running.',
		details: details || undefined,
		data: buildEmptyPositionData(null, 0, null)
	};
}
