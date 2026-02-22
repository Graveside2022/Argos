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

/** Build a successful GPS fix response with position data */
export function buildFixedPositionResponse(
	tpvData: TPVData,
	satelliteCount: number
): GpsPositionResponse {
	return {
		success: true,
		data: {
			latitude: tpvData.lat ?? null,
			longitude: tpvData.lon ?? null,
			altitude: tpvData.alt ?? null,
			speed: tpvData.speed ?? null,
			heading: tpvData.track ?? null,
			accuracy: tpvData.epx ?? tpvData.epy ?? 10,
			satellites: satelliteCount,
			fix: tpvData.mode,
			time: tpvData.time ?? null
		}
	};
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
