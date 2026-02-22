import { Socket } from 'net';
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

/**
 * Query gpsd using TCP socket (same pattern as position endpoint).
 */
function queryGpsd(timeoutMs: number = 3000): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let resolved = false;

		const socket = new Socket();
		socket.setTimeout(timeoutMs);

		const cleanup = () => {
			if (!socket.destroyed) {
				socket.destroy();
			}
		};

		const finish = (result: string | null, error?: Error) => {
			if (resolved) return;
			resolved = true;
			cleanup();
			if (error) {
				reject(error);
			} else {
				resolve(result || '');
			}
		};

		socket.on('connect', () => {
			socket.write('?WATCH={"enable":true,"json":true}\n');

			// Collect data for 10 seconds to catch SKY message with satellite array.
			// gpsd only includes per-satellite data in ~1 of every 7 SKY messages,
			// so 5s was too short. This endpoint is only called when the satellite
			// panel is expanded (not on every poll), so the extra latency is acceptable.
			setTimeout(() => {
				finish(Buffer.concat(chunks).toString('utf8'));
			}, 10000);
		});

		socket.on('data', (chunk: Buffer) => {
			chunks.push(chunk);
		});

		socket.on('timeout', () => {
			if (chunks.length > 0) {
				finish(Buffer.concat(chunks).toString('utf8'));
			} else {
				finish(null, new Error('Connection to gpsd timed out'));
			}
		});

		socket.on('error', (err: Error) => {
			finish(null, err);
		});

		socket.on('close', () => {
			if (!resolved) {
				if (chunks.length > 0) {
					finish(Buffer.concat(chunks).toString('utf8'));
				} else {
					finish(null, new Error('Connection closed without data'));
				}
			}
		});

		socket.connect(2947, 'localhost');
	});
}

/**
 * Map gpsd gnssid to constellation name.
 */
function mapConstellation(gnssid: number): Satellite['constellation'] {
	switch (gnssid) {
		case 0:
		case 1: // SBAS (show as GPS)
			return 'GPS';
		case 2:
			return 'Galileo';
		case 3:
			return 'BeiDou';
		case 6:
			return 'GLONASS';
		default:
			return 'GPS'; // Fallback
	}
}

/**
 * Parse SKY message and extract satellite data.
 */
function parseSatellites(data: unknown): Satellite[] {
	if (typeof data !== 'object' || data === null) {
		return [];
	}

	// Safe: Type cast for dynamic data access
	// Safe: gpsd JSON response cast to Record for dynamic field access
	const obj = data as Record<string, unknown>;

	if (typeof obj.class !== 'string' || obj.class !== 'SKY') {
		return [];
	}

	if (!Array.isArray(obj.satellites)) {
		return [];
	}

	return obj.satellites
		.filter((sat: unknown) => {
			return (
				typeof sat === 'object' &&
				sat !== null &&
				// Safe: Type cast for dynamic data access
				// Safe: satellite array elements cast to Record for PRN/gnssid field validation
				typeof (sat as Record<string, unknown>).PRN === 'number' &&
				// Safe: Type cast for dynamic data access
				typeof (sat as Record<string, unknown>).gnssid === 'number'
			);
		})
		.map((sat: Record<string, unknown>) => ({
			prn: sat.PRN as number,
			constellation: mapConstellation(sat.gnssid as number),
			snr: (sat.ss as number) || 0,
			elevation: (sat.el as number) || 0,
			azimuth: (sat.az as number) || 0,
			used: (sat.used as boolean) || false
		}));
}

interface ParsedSkyResult {
	satellites: Satellite[];
	usedSatCount: number;
}

/**
 * Parse all gpsd output lines, collecting satellite arrays from SKY messages
 * and tracking the maximum uSat (used satellite count) seen.
 */
function parseGpsdSkyLines(rawOutput: string): ParsedSkyResult {
	let satellites: Satellite[] = [];
	let usedSatCount = 0;
	const lines = rawOutput.trim().split('\n');

	for (const line of lines) {
		if (line.trim() === '') continue;

		const result = safeJsonParse(line, GpsdSkySchema, 'gps-satellites');
		if (!result.success) continue;

		const parsed = parseSatellites(result.data);
		if (parsed.length > satellites.length) {
			satellites = parsed;
		}

		// Capture uSat (used satellite count) if present
		// Safe: gpsd response data cast to Record for SKY/TPV field access
		const obj = result.data as Record<string, unknown>;
		if (typeof obj.uSat === 'number' && obj.uSat > usedSatCount) {
			usedSatCount = obj.uSat;
		}
	}

	return { satellites, usedSatCount };
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
		const allLines = await queryGpsd(12000);
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
