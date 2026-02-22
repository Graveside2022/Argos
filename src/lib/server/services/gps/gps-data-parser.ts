/**
 * GPS data parsing utilities for gpsd JSON protocol messages.
 * Extracted from gps-position-service.ts for constitutional compliance (Article 2.2).
 */

import { z } from 'zod';

import { safeJsonParse } from '$lib/server/security/safe-json';
import { logger } from '$lib/utils/logger';

/** Zod schema for gpsd JSON protocol messages (TPV, SKY, VERSION, DEVICES, etc.) */
export const GpsdMessageSchema = z
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

export interface TPVData {
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
	satellites?: Array<{ used?: boolean }>;
	uSat?: number;
	nSat?: number;
}

interface SatelliteData {
	used?: boolean;
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

/** Parse a TPV (Time-Position-Velocity) message from gpsd output. */
export function parseTPVData(data: unknown): TPVData | null {
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

/** Parse a SKY message from gpsd output. */
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
 * Extract satellite count from a parsed SKY message.
 * Returns the satellite count or null if the message is not a SKY message.
 */
export function extractSatelliteCount(parsed: unknown): number | null {
	const skyMsg = parseSkyMessage(parsed);
	if (!skyMsg) return null;

	// gpsd 3.20+ provides uSat (used satellite count) directly
	if (typeof skyMsg.uSat === 'number') {
		return skyMsg.uSat;
	}
	if (skyMsg.satellites && skyMsg.satellites.length > 0) {
		// Fallback: count satellites with used=true (older gpsd versions)
		return skyMsg.satellites.filter((sat) => sat.used === true).length;
	}
	return null;
}

/**
 * Parse all gpsd output lines, extracting the first TPV message and
 * any satellite count updates from SKY messages.
 *
 * @returns Object with tpvData and updated satellite count (if any SKY msg found)
 */
export function parseGpsdLines(rawOutput: string): {
	tpvData: TPVData | null;
	satelliteCount: number | null;
} {
	let tpvData: TPVData | null = null;
	let satelliteCount: number | null = null;
	const lines = rawOutput.trim().split('\n');

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

			const skyCount = extractSatelliteCount(parsed);
			if (skyCount !== null) {
				satelliteCount = skyCount;
			}
		} catch (_error: unknown) {
			// Skip non-JSON lines (e.g. gpsd banner)
		}
	}

	return { tpvData, satelliteCount };
}
