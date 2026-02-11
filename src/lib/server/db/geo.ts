/**
 * Geographic utility functions for the RF database layer.
 * Pure functions with no database dependency.
 */

import { GEO } from '$lib/constants/limits';
import type { SignalMarker } from '$lib/types/signals';
import type { DbSignal } from './types';

/** Meters per degree of latitude (approximate constant) */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = GEO.EARTH_RADIUS_M;
	const phi1 = (lat1 * Math.PI) / 180;
	const phi2 = (lat2 * Math.PI) / 180;
	const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
	const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

	const a =
		Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
		Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
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
	const latRange = radiusMeters / METERS_PER_DEGREE_LAT;
	const lonRange = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

	return {
		lat_min: Math.floor((lat - latRange) * 10000),
		lat_max: Math.ceil((lat + latRange) * 10000),
		lon_min: Math.floor((lon - lonRange) * 10000),
		lon_max: Math.ceil((lon + lonRange) * 10000)
	};
}

/**
 * Detect device type based on frequency in MHz.
 */
export function detectDeviceType(freq: number): string {
	if (freq >= 2400 && freq <= 2500) return 'wifi';
	if (freq >= 5150 && freq <= 5850) return 'wifi';
	if (freq >= 2400 && freq <= 2485) return 'bluetooth';
	if (freq >= 800 && freq <= 900) return 'cellular';
	if (freq >= 1800 && freq <= 1900) return 'cellular';
	return 'unknown';
}

/**
 * Convert a database signal row to a SignalMarker for the frontend.
 */
export function dbSignalToMarker(dbSignal: DbSignal): SignalMarker {
	let metadata: Record<string, unknown> = {};
	if (dbSignal.metadata) {
		try {
			metadata = JSON.parse(dbSignal.metadata) as Record<string, unknown>;
		} catch (_error) {
			console.warn('[geo] Invalid metadata JSON in database', {
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
		source: dbSignal.source as SignalMarker['source'],
		metadata: metadata as SignalMarker['metadata']
	};
}

/**
 * Generate a synthetic device ID from a signal's characteristics.
 * Uses signal type, frequency, and power band as a composite key.
 */
export function generateDeviceId(signal: SignalMarker): string {
	let metadata: Record<string, unknown> = {};
	if (signal.metadata) {
		if (typeof signal.metadata === 'string') {
			try {
				metadata = JSON.parse(signal.metadata);
			} catch (_error) {
				console.warn('[geo] Invalid metadata JSON in generateDeviceId');
				metadata = {};
			}
		} else {
			metadata = signal.metadata;
		}
	}
	const signalType = metadata.signalType || metadata.type || 'unknown';
	return `${signalType}_${Math.floor(signal.frequency)}_${Math.floor(signal.power / 10) * 10}`;
}
