/**
 * Spatial repository: area-based queries for devices and statistics.
 */

import type Database from 'better-sqlite3';

import { convertRadiusToGrid } from './geo';
import type { DbDevice, SpatialQuery, TimeQuery } from './types';

/**
 * Find devices near a geographic point.
 * Returns device records enriched with average position and signal count.
 */
export function findDevicesNearby(
	_db: Database.Database,
	statements: Map<string, Database.Statement>,
	query: SpatialQuery & TimeQuery
): Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }> {
	const grid = convertRadiusToGrid(query.lat, query.lon, query.radiusMeters);

	const stmt = statements.get('findNearbyDevices');
	if (!stmt) throw new Error('Find nearby devices statement not found');

	// @constitutional-exemption Article-II-2.1 issue:#14 — R-tree spatial query result type narrowing — better-sqlite3 returns generic objects
	return stmt.all({
		lat_min: grid.lat_min,
		lat_max: grid.lat_max,
		lon_min: grid.lon_min,
		lon_max: grid.lon_max,
		since: query.startTime || Date.now() - 300000 // Default: last 5 minutes
		// Safe: SQLite query returns aggregated device rows with computed columns
	}) as Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }>;
}

/**
 * Aggregate statistics for signals within a bounding box and time window.
 */
export function getAreaStatistics(
	_db: Database.Database,
	statements: Map<string, Database.Statement>,
	bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
	timeWindow: number = 3600000
): unknown {
	const stmt = statements.get('getAreaStatistics');
	if (!stmt) throw new Error('getAreaStatistics statement not found');

	return stmt.get({
		minLat: bounds.minLat,
		maxLat: bounds.maxLat,
		minLon: bounds.minLon,
		maxLon: bounds.maxLon,
		since: Date.now() - timeWindow
	});
}
