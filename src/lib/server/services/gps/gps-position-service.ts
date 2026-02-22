import { logger } from '$lib/utils/logger';

import { parseGpsdLines, type TPVData } from './gps-data-parser';
import {
	buildFixedPositionResponse,
	buildNoDataResponse,
	buildNoFixResponse
} from './gps-response-builder';
import { queryGpsd } from './gps-socket';

// Cache last known satellite count from full SKY messages (accurate per-satellite data).
// Full SKY messages only arrive every ~4-5s, so between them we serve the cached value.
let cachedSatelliteCount = 0;

// Cache the last successful TPV data so we can serve it between polls
let cachedTPV: TPVData | null = null;
let cachedTPVTimestamp = 0;
const TPV_CACHE_TTL_MS = 5000; // Serve cached data for up to 5 seconds

// Circuit breaker state: backs off when gpsd is unreachable to avoid
// wasting resources on doomed connection attempts.
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000; // 30 seconds between retries when circuit is open
let lastFailureTimestamp = 0;
let circuitBreakerLogged = false;

export interface GpsPositionResponse {
	success: boolean;
	data: {
		latitude: number | null;
		longitude: number | null;
		altitude: number | null;
		speed: number | null;
		heading: number | null;
		accuracy: number | null;
		satellites: number | null;
		fix: number;
		time: string | null;
	};
	error?: string;
	details?: string;
	mode?: number;
}

/** Build a GPS response JSON payload, dispatching to the appropriate response builder */
function buildGpsResponse(
	success: boolean,
	tpvData: TPVData | null,
	error?: string,
	details?: string
): GpsPositionResponse {
	if (success && tpvData && tpvData.mode >= 2) {
		return buildFixedPositionResponse(tpvData, cachedSatelliteCount);
	}
	if (tpvData) {
		return buildNoFixResponse(tpvData, cachedSatelliteCount, error);
	}
	return buildNoDataResponse(error, details);
}

/**
 * Check the circuit breaker and return a cached or error response if the
 * breaker is still open. Returns null when the caller should proceed
 * with a fresh gpsd query (breaker closed or half-open).
 */
function checkPositionCircuitBreaker(): GpsPositionResponse | null {
	if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) {
		return null;
	}

	const timeSinceLastFailure = Date.now() - lastFailureTimestamp;

	if (timeSinceLastFailure >= CIRCUIT_BREAKER_COOLDOWN_MS) {
		return null;
	}

	if (!circuitBreakerLogged) {
		logger.warn(
			'[GPS] Circuit breaker open: gpsd unreachable, backing off to 30s retries',
			{ consecutiveFailures, cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS },
			'gps-circuit-breaker'
		);
		circuitBreakerLogged = true;
	}

	if (cachedTPV && Date.now() - cachedTPVTimestamp < 30000) {
		return buildGpsResponse(cachedTPV.mode >= 2, cachedTPV);
	}

	return buildGpsResponse(
		false,
		null,
		'GPS service temporarily unavailable (circuit breaker active)'
	);
}

/**
 * Record a gpsd connection failure and return a cached or error response.
 * Activates the circuit breaker after reaching the failure threshold.
 */
function handlePositionQueryFailure(error: unknown): GpsPositionResponse {
	consecutiveFailures++;
	lastFailureTimestamp = Date.now();

	if (consecutiveFailures === CIRCUIT_BREAKER_THRESHOLD) {
		logger.warn(
			'[GPS] gpsd connection failed, circuit breaker activating',
			{
				consecutiveFailures,
				error: error instanceof Error ? error.message : String(error)
			},
			'gps-circuit-open'
		);
	}

	if (cachedTPV && Date.now() - cachedTPVTimestamp < 30000) {
		return buildGpsResponse(cachedTPV.mode >= 2, cachedTPV);
	}

	return buildGpsResponse(
		false,
		null,
		'GPS service not available. Make sure gpsd is running.',
		error instanceof Error ? error.message : 'Unknown error'
	);
}

/**
 * Get current GPS position from gpsd with circuit breaker and caching.
 * Uses TCP socket to query gpsd for TPV (position) and SKY (satellite) messages.
 *
 * Features:
 * - Circuit breaker pattern (3 failures triggers 30s cooldown)
 * - Response caching (5s TTL for fresh data, 30s for fallback)
 * - Satellite count tracking from SKY messages
 * - Graceful degradation (serves cached data when gpsd unavailable)
 */
export async function getGpsPosition(): Promise<GpsPositionResponse> {
	const circuitBreakerResponse = checkPositionCircuitBreaker();
	if (circuitBreakerResponse) return circuitBreakerResponse;

	// Serve cached data if it is still fresh (avoids redundant queries)
	if (cachedTPV && Date.now() - cachedTPVTimestamp < TPV_CACHE_TTL_MS) {
		return buildGpsResponse(cachedTPV.mode >= 2, cachedTPV);
	}

	try {
		const allLines = await queryGpsd({ timeoutMs: 3000, collectMs: 2000 });
		const { tpvData, satelliteCount } = parseGpsdLines(allLines);

		// Update satellite count if a SKY message was found
		if (satelliteCount !== null) {
			cachedSatelliteCount = satelliteCount;
		}

		if (!tpvData) {
			throw new Error('Failed to parse TPV data from gpsd response');
		}

		// Success -- reset circuit breaker
		consecutiveFailures = 0;
		circuitBreakerLogged = false;

		// Update cache
		cachedTPV = tpvData;
		cachedTPVTimestamp = Date.now();

		return buildGpsResponse(tpvData.mode >= 2, tpvData);
	} catch (error: unknown) {
		return handlePositionQueryFailure(error);
	}
}
