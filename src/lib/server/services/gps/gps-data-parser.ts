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

/** Extract a numeric field from a dynamic object, returning undefined if not a number */
function numField(obj: Record<string, unknown>, key: string): number | undefined {
	const val = obj[key];
	return typeof val === 'number' ? val : undefined;
}

/** Extract a string field from a dynamic object, returning undefined if not a string */
function strField(obj: Record<string, unknown>, key: string): string | undefined {
	const val = obj[key];
	return typeof val === 'string' ? val : undefined;
}

/** Validate that data is a TPV-class gpsd object, returning the typed Record or null */
function asTPVObject(data: unknown): Record<string, unknown> | null {
	if (typeof data !== 'object' || data === null) return null;
	const obj = data as Record<string, unknown>;
	if (obj.class !== 'TPV') return null;
	return obj;
}

/** Parse a TPV (Time-Position-Velocity) message from gpsd output. */
export function parseTPVData(data: unknown): TPVData | null {
	const obj = asTPVObject(data);
	if (!obj) return null;

	return {
		class: 'TPV',
		mode: numField(obj, 'mode') ?? 0,
		lat: numField(obj, 'lat'),
		lon: numField(obj, 'lon'),
		alt: numField(obj, 'alt'),
		speed: numField(obj, 'speed'),
		track: numField(obj, 'track'),
		epx: numField(obj, 'epx'),
		epy: numField(obj, 'epy'),
		time: strField(obj, 'time')
	};
}

/** Validate that data is a SKY-class gpsd object, returning the typed Record or null */
function asSKYObject(data: unknown): Record<string, unknown> | null {
	if (typeof data !== 'object' || data === null) return null;
	const obj = data as Record<string, unknown>;
	if (obj.class !== 'SKY') return null;
	return obj;
}

/** Parse a SKY message from gpsd output. */
function parseSkyMessage(data: unknown): SkyMessage | null {
	const obj = asSKYObject(data);
	if (!obj) return null;

	return {
		class: 'SKY',
		satellites: isSatelliteArray(obj.satellites) ? obj.satellites : undefined,
		uSat: numField(obj, 'uSat'),
		nSat: numField(obj, 'nSat')
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
/** Parse a single gpsd line, returning validated data or null */
function parseGpsdLine(line: string): z.infer<typeof GpsdMessageSchema> | null {
	if (line.trim() === '') return null;
	const result = safeJsonParse(line, GpsdMessageSchema, 'gps-position');
	if (!result.success) {
		logger.warn('[gps] Malformed gpsd data, skipping line', undefined, 'gps-malformed-data');
		return null;
	}
	return result.data;
}

/** Process a parsed gpsd message, updating tpv and satellite state */
function processGpsdMessage(
	parsed: z.infer<typeof GpsdMessageSchema>,
	state: { tpvData: TPVData | null; satelliteCount: number | null }
): void {
	if (!state.tpvData) state.tpvData = parseTPVData(parsed);
	const skyCount = extractSatelliteCount(parsed);
	if (skyCount !== null) state.satelliteCount = skyCount;
}

export function parseGpsdLines(rawOutput: string): {
	tpvData: TPVData | null;
	satelliteCount: number | null;
} {
	const state = { tpvData: null as TPVData | null, satelliteCount: null as number | null };
	const lines = rawOutput.trim().split('\n');

	for (const line of lines) {
		const parsed = parseGpsdLine(line);
		if (parsed) processGpsdMessage(parsed, state);
	}

	return state;
}
