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

/** Whether the position circuit breaker is open and should block queries */
function isPositionBreakerOpen(): boolean {
	if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) return false;
	return Date.now() - lastFailureTimestamp < CIRCUIT_BREAKER_COOLDOWN_MS;
}

/** Log the breaker-open event exactly once */
function logPositionBreakerOpen(): void {
	if (circuitBreakerLogged) return;
	logger.warn(
		'[GPS] Circuit breaker open: gpsd unreachable, backing off to 30s retries',
		{ consecutiveFailures, cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS },
		'gps-circuit-breaker'
	);
	circuitBreakerLogged = true;
}

/** Return cached position if still fresh, else an error response */
function serveCachedOrErrorPosition(): GpsPositionResponse {
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
 * Check the circuit breaker and return a cached or error response if the
 * breaker is still open. Returns null when the caller should proceed.
 */
function checkPositionCircuitBreaker(): GpsPositionResponse | null {
	if (!isPositionBreakerOpen()) return null;
	logPositionBreakerOpen();
	return serveCachedOrErrorPosition();
}

/** Log circuit breaker activation when the threshold is first reached */
function logBreakerActivation(error: unknown): void {
	if (consecutiveFailures !== CIRCUIT_BREAKER_THRESHOLD) return;
	logger.warn(
		'[GPS] gpsd connection failed, circuit breaker activating',
		{
			consecutiveFailures,
			error: error instanceof Error ? error.message : String(error)
		},
		'gps-circuit-open'
	);
}

/** Return cached position or a gpsd-unavailable error */
function serveCachedOrGpsdError(error: unknown): GpsPositionResponse {
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
 * Record a gpsd connection failure and return a cached or error response.
 */
function handlePositionQueryFailure(error: unknown): GpsPositionResponse {
	consecutiveFailures++;
	lastFailureTimestamp = Date.now();
	logBreakerActivation(error);
	return serveCachedOrGpsdError(error);
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
/** Check if cached TPV data is still fresh */
function hasFreshCache(): boolean {
	return Boolean(cachedTPV) && Date.now() - cachedTPVTimestamp < TPV_CACHE_TTL_MS;
}

/** Process a successful gpsd query result, updating cache and circuit breaker */
function processGpsdResult(tpvData: TPVData, satelliteCount: number | null): GpsPositionResponse {
	if (satelliteCount !== null) cachedSatelliteCount = satelliteCount;
	consecutiveFailures = 0;
	circuitBreakerLogged = false;
	cachedTPV = tpvData;
	cachedTPVTimestamp = Date.now();
	return buildGpsResponse(tpvData.mode >= 2, tpvData);
}

export async function getGpsPosition(): Promise<GpsPositionResponse> {
	const circuitBreakerResponse = checkPositionCircuitBreaker();
	if (circuitBreakerResponse) return circuitBreakerResponse;

	if (hasFreshCache()) return buildGpsResponse(cachedTPV!.mode >= 2, cachedTPV);

	try {
		const allLines = await queryGpsd({ timeoutMs: 3000, collectMs: 2000 });
		const { tpvData, satelliteCount } = parseGpsdLines(allLines);
		if (!tpvData) throw new Error('Failed to parse TPV data from gpsd response');
		return processGpsdResult(tpvData, satelliteCount);
	} catch (error: unknown) {
		return handlePositionQueryFailure(error);
	}
}
