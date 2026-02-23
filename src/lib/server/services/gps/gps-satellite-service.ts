import { z } from 'zod';

import type { Satellite, SatellitesApiResponse } from '$lib/gps/types';
import { safeJsonParse } from '$lib/server/security/safe-json';

import {
	CACHE_TTL_MS,
	checkSatelliteCircuitBreaker,
	getCachedSatellites,
	handleSatelliteQueryFailure,
	resetCircuitBreaker,
	updateCache
} from './gps-satellite-circuit-breaker';
import { queryGpsd } from './gps-socket';

// Zod schema for gpsd SKY message with full satellite data
const GpsdSkySchema = z
	.object({
		class: z.string(),
		satellites: z
			.array(
				z
					.object({
						PRN: z.number(),
						gnssid: z.number(),
						ss: z.number(), // Signal strength (SNR in dB)
						el: z.number(), // Elevation
						az: z.number(), // Azimuth
						used: z.boolean()
					})
					.passthrough()
			)
			.optional()
	})
	.passthrough();

/** gnssid → constellation lookup (0=GPS, 1=SBAS→GPS, 2=Galileo, 3=BeiDou, 6=GLONASS) */
const CONSTELLATION_MAP: Record<number, Satellite['constellation']> = {
	0: 'GPS',
	1: 'GPS',
	2: 'Galileo',
	3: 'BeiDou',
	6: 'GLONASS'
};

/** Map gpsd gnssid to constellation name. */
function mapConstellation(gnssid: number): Satellite['constellation'] {
	return CONSTELLATION_MAP[gnssid] ?? 'GPS';
}

/** Validate that data is a SKY-class gpsd object with a satellites array */
function asSkyWithSatellites(data: unknown): Record<string, unknown>[] | null {
	if (typeof data !== 'object' || data === null) return null;
	const obj = data as Record<string, unknown>;
	if (obj.class !== 'SKY' || !Array.isArray(obj.satellites)) return null;
	return obj.satellites as Record<string, unknown>[];
}

/** Type guard: satellite entry has required numeric PRN and gnssid fields */
function isValidSatEntry(sat: unknown): sat is Record<string, unknown> {
	if (typeof sat !== 'object' || sat === null) return false;
	const rec = sat as Record<string, unknown>;
	return typeof rec.PRN === 'number' && typeof rec.gnssid === 'number';
}

/** Map a raw satellite record to a typed Satellite object */
function toSatellite(sat: Record<string, unknown>): Satellite {
	return {
		prn: sat.PRN as number,
		constellation: mapConstellation(sat.gnssid as number),
		snr: (sat.ss as number) || 0,
		elevation: (sat.el as number) || 0,
		azimuth: (sat.az as number) || 0,
		used: (sat.used as boolean) || false
	};
}

/** Parse SKY message and extract satellite data. */
function parseSatellites(data: unknown): Satellite[] {
	const satellites = asSkyWithSatellites(data);
	if (!satellites) return [];
	return satellites.filter(isValidSatEntry).map(toSatellite);
}

interface ParsedSkyResult {
	satellites: Satellite[];
	usedSatCount: number;
}

/** Parse a single gpsd sky line, returning validated data or null */
function parseSkyLine(line: string): z.infer<typeof GpsdSkySchema> | null {
	if (line.trim() === '') return null;
	const result = safeJsonParse(line, GpsdSkySchema, 'gps-satellites');
	return result.success ? result.data : null;
}

/** Extract uSat from a parsed gpsd message, or 0 */
function extractUSat(data: z.infer<typeof GpsdSkySchema>): number {
	const obj = data as Record<string, unknown>;
	return typeof obj.uSat === 'number' ? obj.uSat : 0;
}

/** Accumulate satellites and uSat from a single parsed line */
function processSkyLine(state: ParsedSkyResult, data: z.infer<typeof GpsdSkySchema>): void {
	const parsed = parseSatellites(data);
	if (parsed.length > state.satellites.length) state.satellites = parsed;
	const uSat = extractUSat(data);
	if (uSat > state.usedSatCount) state.usedSatCount = uSat;
}

/**
 * Parse all gpsd output lines, collecting satellite arrays from SKY messages
 * and tracking the maximum uSat (used satellite count) seen.
 */
function parseGpsdSkyLines(rawOutput: string): ParsedSkyResult {
	const state: ParsedSkyResult = { satellites: [], usedSatCount: 0 };
	for (const line of rawOutput.trim().split('\n')) {
		const data = parseSkyLine(line);
		if (data) processSkyLine(state, data);
	}
	return state;
}

/**
 * Mark the top N satellites (by signal strength) as "used" based on the
 * uSat count from gpsd.  Mutates the satellite array in place.
 */
function markUsedSatellitesBySnr(satellites: Satellite[], usedSatCount: number): void {
	if (usedSatCount <= 0 || satellites.length === 0) return;

	const sorted = [...satellites].sort((a, b) => b.snr - a.snr);
	for (let i = 0; i < Math.min(usedSatCount, sorted.length); i++) {
		const sat = satellites.find((s) => s.prn === sorted[i].prn);
		if (sat) sat.used = true;
	}
}

/**
 * Get satellite data from gpsd with circuit breaker and caching.
 * Uses TCP socket to query gpsd for SKY messages containing satellite visibility data.
 *
 * Features:
 * - Circuit breaker pattern (3 failures triggers 30s cooldown)
 * - Response caching (5s TTL for fresh data, 30s for fallback)
 * - Graceful degradation (serves cached data when gpsd unavailable)
 *
 * @returns Satellite data with success status and error messages
 */
export async function getSatelliteData(): Promise<SatellitesApiResponse> {
	const circuitBreakerResponse = checkSatelliteCircuitBreaker();
	if (circuitBreakerResponse) return circuitBreakerResponse;

	// Serve cached data if fresh
	const cached = getCachedSatellites();
	if (cached.satellites.length > 0 && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return { success: true, satellites: cached.satellites };
	}

	try {
		// Collect for 10s to catch per-satellite SKY messages (~1 in 7 cycles)
		const allLines = await queryGpsd({ timeoutMs: 12000, collectMs: 10000 });
		const { satellites, usedSatCount } = parseGpsdSkyLines(allLines);

		markUsedSatellitesBySnr(satellites, usedSatCount);

		// Success - reset circuit breaker
		resetCircuitBreaker();

		// Update cache
		updateCache(satellites);

		return { success: true, satellites };
	} catch (error: unknown) {
		return handleSatelliteQueryFailure(error);
	}
}
