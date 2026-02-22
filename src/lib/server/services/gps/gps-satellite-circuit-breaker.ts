/**
 * Circuit breaker for gpsd satellite queries.
 * Tracks consecutive failures and provides cached/error responses
 * when the breaker is open.
 */

import type { Satellite, SatellitesApiResponse } from '$lib/gps/types';
import { logWarn } from '$lib/utils/logger';

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;

let consecutiveFailures = 0;
let lastFailureTimestamp = 0;
let circuitBreakerLogged = false;

// Cache satellite data
let cachedSatellites: Satellite[] = [];
let cachedTimestamp = 0;

export const CACHE_TTL_MS = 5000;

export function getCachedSatellites(): { satellites: Satellite[]; timestamp: number } {
	return { satellites: cachedSatellites, timestamp: cachedTimestamp };
}

export function updateCache(satellites: Satellite[]): void {
	cachedSatellites = satellites;
	cachedTimestamp = Date.now();
}

export function resetCircuitBreaker(): void {
	consecutiveFailures = 0;
	circuitBreakerLogged = false;
}

/**
 * Check the satellite circuit breaker and return a cached or error response
 * if the breaker is still open. Returns null when the caller should proceed
 * with a fresh gpsd query (breaker closed or half-open).
 */
export function checkSatelliteCircuitBreaker(): SatellitesApiResponse | null {
	if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) {
		return null;
	}

	const timeSinceLastFailure = Date.now() - lastFailureTimestamp;

	if (timeSinceLastFailure >= CIRCUIT_BREAKER_COOLDOWN_MS) {
		// Cooldown elapsed -- allow a retry (half-open state)
		return null;
	}

	if (!circuitBreakerLogged) {
		logWarn(
			'[GPS Satellites] Circuit breaker open: gpsd unreachable',
			{ consecutiveFailures },
			'gps-satellites-circuit-breaker'
		);
		circuitBreakerLogged = true;
	}

	if (cachedSatellites.length > 0 && Date.now() - cachedTimestamp < 30000) {
		return { success: true, satellites: cachedSatellites };
	}

	return { success: false, satellites: [], error: 'GPS service temporarily unavailable' };
}

/**
 * Record a gpsd satellite connection failure and return a cached or error
 * response. Activates the circuit breaker after reaching the threshold.
 */
export function handleSatelliteQueryFailure(error: unknown): SatellitesApiResponse {
	consecutiveFailures++;
	lastFailureTimestamp = Date.now();

	if (consecutiveFailures === CIRCUIT_BREAKER_THRESHOLD) {
		logWarn(
			'[GPS Satellites] gpsd connection failed, circuit breaker activating',
			{
				consecutiveFailures,
				error: error instanceof Error ? error.message : String(error)
			},
			'gps-satellites-circuit-open'
		);
	}

	if (cachedSatellites.length > 0 && Date.now() - cachedTimestamp < 30000) {
		return { success: true, satellites: cachedSatellites };
	}

	return { success: false, satellites: [], error: 'GPS service not available' };
}
