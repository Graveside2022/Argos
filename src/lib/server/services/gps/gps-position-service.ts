import { Socket } from 'net';
import { z } from 'zod';

import { safeJsonParse } from '$lib/server/security/safe-json';
import { logger } from '$lib/utils/logger';

// Zod schema for gpsd JSON protocol messages (TPV, SKY, VERSION, DEVICES, etc.)
const GpsdMessageSchema = z
	.object({
		class: z.string(),
		mode: z.number().optional(),
		lat: z.number().optional(),
		lon: z.number().optional(),
		alt: z.number().optional(),
		speed: z.number().optional(),
		track: z.number().optional(),
		epx: z.number().optional(),
		epy: z.number().optional(),
		time: z.string().optional(),
		satellites: z
			.array(
				z
					.object({
						used: z.boolean().optional()
					})
					.passthrough()
			)
			.optional(),
		uSat: z.number().optional(),
		nSat: z.number().optional()
	})
	.passthrough();

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

interface TPVData {
	class: string;
	mode: number;
	lat?: number;
	lon?: number;
	alt?: number;
	speed?: number;
	track?: number;
	epx?: number;
	epy?: number;
	time?: string;
}

interface SkyMessage {
	class: string;
	satellites?: Array<{
		used?: boolean;
	}>;
	uSat?: number; // Used satellites count (GPSD 3.20+)
	nSat?: number; // Total visible satellites
}

interface SatelliteData {
	used?: boolean;
}

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

function isSatelliteArray(value: unknown): value is SatelliteData[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				typeof item === 'object' &&
				item !== null &&
				// Safe: item cast to SatelliteData for 'used' field type check; validated by condition
				(typeof (item as SatelliteData).used === 'boolean' ||
					(item as SatelliteData).used === undefined) // Safe: same SatelliteData cast as line above
		)
	);
}

function parseTPVData(data: unknown): TPVData | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	// Safe: Type cast for dynamic data access
	const obj = data as Record<string, unknown>;

	if (typeof obj.class !== 'string' || obj.class !== 'TPV') {
		return null;
	}

	return {
		class: obj.class,
		mode: typeof obj.mode === 'number' ? obj.mode : 0,
		lat: typeof obj.lat === 'number' ? obj.lat : undefined,
		lon: typeof obj.lon === 'number' ? obj.lon : undefined,
		alt: typeof obj.alt === 'number' ? obj.alt : undefined,
		speed: typeof obj.speed === 'number' ? obj.speed : undefined,
		track: typeof obj.track === 'number' ? obj.track : undefined,
		epx: typeof obj.epx === 'number' ? obj.epx : undefined,
		epy: typeof obj.epy === 'number' ? obj.epy : undefined,
		time: typeof obj.time === 'string' ? obj.time : undefined
	};
}

function parseSkyMessage(data: unknown): SkyMessage | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	// Safe: Type cast for dynamic data access
	const obj = data as Record<string, unknown>;

	if (typeof obj.class !== 'string' || obj.class !== 'SKY') {
		return null;
	}

	return {
		class: obj.class,
		satellites: isSatelliteArray(obj.satellites) ? obj.satellites : undefined,
		uSat: typeof obj.uSat === 'number' ? obj.uSat : undefined,
		nSat: typeof obj.nSat === 'number' ? obj.nSat : undefined
	};
}

/**
 * Query gpsd using a short-lived TCP socket connection.
 * This avoids spawning bash/nc/timeout child processes on every call,
 * eliminating the ~12,960 process spawns over 6 hours that contributed
 * to memory exhaustion.
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
			// Send WATCH command to enable JSON output
			socket.write('?WATCH={"enable":true,"json":true}\n');

			// Collect data for up to 2 seconds, then close
			setTimeout(() => {
				finish(Buffer.concat(chunks).toString('utf8'));
			}, 2000);
		});

		socket.on('data', (chunk: Buffer) => {
			chunks.push(chunk);
		});

		socket.on('timeout', () => {
			// If we have data, return it; otherwise error
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
 * Build a GPS response JSON payload.
 */
function buildGpsResponse(
	success: boolean,
	tpvData: TPVData | null,
	error?: string,
	details?: string
): GpsPositionResponse {
	if (success && tpvData && tpvData.mode >= 2) {
		return {
			success: true,
			data: {
				latitude: tpvData.lat ?? null,
				longitude: tpvData.lon ?? null,
				altitude: tpvData.alt ?? null,
				speed: tpvData.speed ?? null,
				heading: tpvData.track ?? null,
				accuracy: tpvData.epx ?? tpvData.epy ?? 10,
				satellites: cachedSatelliteCount,
				fix: tpvData.mode,
				time: tpvData.time ?? null
			}
		};
	}

	if (tpvData) {
		return {
			success: false,
			error: error || 'No GPS fix available',
			data: {
				latitude: null,
				longitude: null,
				altitude: null,
				speed: null,
				heading: null,
				accuracy: null,
				satellites: cachedSatelliteCount,
				fix: tpvData.mode,
				time: tpvData.time ?? null
			},
			mode: tpvData.mode
		};
	}

	return {
		success: false,
		error: error || 'GPS service not available. Make sure gpsd is running.',
		details: details || undefined,
		data: {
			latitude: null,
			longitude: null,
			altitude: null,
			speed: null,
			heading: null,
			accuracy: null,
			satellites: null,
			fix: 0,
			time: null
		}
	};
}

/**
 * Get current GPS position from gpsd with circuit breaker and caching
 * Uses TCP socket to query gpsd for TPV (position) and SKY (satellite) messages
 *
 * Features:
 * - Circuit breaker pattern (3 failures triggers 30s cooldown)
 * - Response caching (5s TTL for fresh data, 30s for fallback)
 * - Satellite count tracking from SKY messages
 * - Graceful degradation (serves cached data when gpsd unavailable)
 *
 * @returns GPS position data with fix status, coordinates, and satellite info
 */
export async function getGpsPosition(): Promise<GpsPositionResponse> {
	// Circuit breaker: if gpsd has been unreachable, return cached data
	// or a soft error without attempting a connection.
	if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
		const timeSinceLastFailure = Date.now() - lastFailureTimestamp;

		if (timeSinceLastFailure < CIRCUIT_BREAKER_COOLDOWN_MS) {
			// Circuit is open -- serve cached data if fresh enough, otherwise soft error
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

		// Cooldown elapsed -- allow a retry (half-open state)
	}

	// Serve cached data if it is still fresh (avoids redundant queries)
	if (cachedTPV && Date.now() - cachedTPVTimestamp < TPV_CACHE_TTL_MS) {
		return buildGpsResponse(cachedTPV.mode >= 2, cachedTPV);
	}

	try {
		const allLines = await queryGpsd(3000);

		// Parse both TPV and SKY from the output.
		let tpvData: TPVData | null = null;
		const lines = allLines.trim().split('\n');

		for (const line of lines) {
			if (line.trim() === '') continue;

			const result = safeJsonParse(line, GpsdMessageSchema, 'gps-position');
			if (!result.success) {
				logger.warn(
					'[gps] Malformed gpsd data, skipping line',
					undefined,
					'gps-malformed-data'
				);
				continue;
			}

			try {
				const parsed = result.data;

				if (!tpvData) {
					tpvData = parseTPVData(parsed);
				}

				const skyMsg = parseSkyMessage(parsed);
				if (skyMsg) {
					// gpsd 3.20+ provides uSat (used satellite count) directly
					if (typeof skyMsg.uSat === 'number') {
						cachedSatelliteCount = skyMsg.uSat;
					} else if (skyMsg.satellites && skyMsg.satellites.length > 0) {
						// Fallback: count satellites with used=true (older gpsd versions)
						cachedSatelliteCount = skyMsg.satellites.filter(
							(sat) => sat.used === true
						).length;
					}
				}
			} catch (_error: unknown) {
				// Skip non-JSON lines (e.g. gpsd banner)
			}
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
		// Record failure for circuit breaker
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

		// Still serve cached data if available
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
}
