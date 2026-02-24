/**
 * Geographic utility functions for the RF database layer.
 * Pure functions with no database dependency.
 */

import { GEO } from '$lib/constants/limits';
import type { SignalMarker } from '$lib/types/signals';
import { haversineMeters } from '$lib/utils/geo';
import { logger } from '$lib/utils/logger';

import type { DbSignal } from './types';

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 * Returns distance in meters. Delegates to the canonical shared implementation.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	return haversineMeters(lat1, lon1, lat2, lon2);
}

/**
 * Check if GPS coordinates represent a valid (non-null, non-zero) location.
 * Used across Kismet device resolution and GPS position extraction.
 */
export function hasValidGpsCoords(
	lat: number | null | undefined,
	lon: number | null | undefined
): boolean {
	return lat != null && lon != null && !(lat === 0 && lon === 0);
}

/**
 * Convert a center point and radius in meters to a bounding box in the
 * spatial-grid coordinate system used by the signals table index
 * (lat/lon multiplied by 10000, then cast to integer).
 */
export function convertRadiusToGrid(
	lat: number,
	lon: number,
	radiusMeters: number
): { lat_min: number; lat_max: number; lon_min: number; lon_max: number } {
	const latRange = radiusMeters / GEO.METERS_PER_DEGREE_LAT;
	const lonRange = radiusMeters / (GEO.METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

	return {
		lat_min: Math.floor((lat - latRange) * 10000),
		lat_max: Math.ceil((lat + latRange) * 10000),
		lon_min: Math.floor((lon - lonRange) * 10000),
		lon_max: Math.ceil((lon + lonRange) * 10000)
	};
}

/** Frequency band definitions for device type classification. */
const FREQUENCY_BANDS: Array<{ min: number; max: number; type: string }> = [
	{ min: 2400, max: 2500, type: 'wifi' },
	{ min: 5150, max: 5850, type: 'wifi' },
	{ min: 2400, max: 2485, type: 'bluetooth' },
	{ min: 800, max: 900, type: 'cellular' },
	{ min: 1800, max: 1900, type: 'cellular' }
];

/**
 * Detect device type based on frequency in MHz.
 */
export function detectDeviceType(freq: number): string {
	return FREQUENCY_BANDS.find((b) => freq >= b.min && freq <= b.max)?.type ?? 'unknown';
}

/**
 * Convert a database signal row to a SignalMarker for the frontend.
 */
export function dbSignalToMarker(dbSignal: DbSignal): SignalMarker {
	let metadata: Record<string, unknown> = {};
	if (dbSignal.metadata) {
		try {
			// Safe: JSON.parse returns unknown; metadata is stored as JSON object in DB column
			metadata = JSON.parse(dbSignal.metadata) as Record<string, unknown>;
		} catch (_error) {
			logger.warn('[geo] Invalid metadata JSON in database', {
				signal_id: dbSignal.signal_id
			});
		}
	}

	return {
		id: dbSignal.signal_id,
		lat: dbSignal.latitude,
		lon: dbSignal.longitude,
		position: { lat: dbSignal.latitude, lon: dbSignal.longitude },
		power: dbSignal.power,
		frequency: dbSignal.frequency,
		timestamp: dbSignal.timestamp,
		// Safe: source column stores the same string union values defined in SignalMarker['source']
		source: dbSignal.source as SignalMarker['source'],
		// Safe: metadata parsed from JSON above and validated to be Record<string, unknown>
		metadata: metadata as SignalMarker['metadata']
	};
}

/** Parse signal metadata to a Record, handling both string and object forms. */
function resolveMetadata(metadata: SignalMarker['metadata']): Record<string, unknown> {
	if (!metadata) return {};
	if (typeof metadata !== 'string') return metadata;
	try {
		return JSON.parse(metadata) as Record<string, unknown>;
	} catch {
		logger.warn('[geo] Invalid metadata JSON in generateDeviceId');
		return {};
	}
}

/**
 * Generate a synthetic device ID from a signal's characteristics.
 * Uses signal type, frequency, and power band as a composite key.
 */
export function generateDeviceId(signal: SignalMarker): string {
	const metadata = resolveMetadata(signal.metadata);
	const signalType = metadata.signalType || metadata.type || 'unknown';
	return `${signalType}_${Math.floor(signal.frequency)}_${Math.floor(signal.power / 10) * 10}`;
}
