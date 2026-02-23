/**
 * Database Inspector MCP Server — tool handler helpers.
 * Extracted from database-inspector.ts for constitutional compliance (Article 2.2).
 */

import { apiFetch } from '../shared/api-client';

/** Run a COUNT query and return the count, defaulting to 0 on failure. */
async function queryCount(query: string, params: number[]): Promise<number> {
	const resp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({ query, params })
	});
	const data = await resp.json();
	return data.success ? data.results[0]?.count || 0 : 0;
}

/** Generate activity recommendations from signal/device counts. */
function generateActivityRecs(signalCount: number, deviceCount: number, minutes: number): string[] {
	const recs: string[] = [];
	if (signalCount === 0) {
		recs.push('No signals captured in last ' + minutes + ' minutes');
		recs.push('Check: Are hardware sources running? (HackRF, Kismet)');
	} else {
		recs.push(`${signalCount} signals captured (${(signalCount / minutes).toFixed(1)}/min)`);
	}
	if (deviceCount === 0 && signalCount > 0) {
		recs.push('Signals captured but no devices tracked');
	}
	return recs;
}

/**
 * Query recent database activity (signals, devices, patterns).
 */
export async function queryRecentActivity(minutes: number): Promise<{
	status: string;
	time_window_minutes: number;
	activity: {
		new_signals: number;
		active_devices: number;
		new_patterns: number;
		signal_rate_per_minute: number;
	};
	recommendations: string[];
}> {
	const timestamp = Date.now() - minutes * 60 * 1000;

	const [signalCount, deviceCount, patternCount] = await Promise.all([
		queryCount('SELECT COUNT(*) as count FROM signals WHERE timestamp > ?', [timestamp]),
		queryCount('SELECT COUNT(*) as count FROM devices WHERE last_seen > ?', [timestamp]),
		queryCount('SELECT COUNT(*) as count FROM patterns WHERE timestamp > ?', [timestamp])
	]);

	return {
		status: 'SUCCESS',
		time_window_minutes: minutes,
		activity: {
			new_signals: signalCount,
			active_devices: deviceCount,
			new_patterns: patternCount,
			signal_rate_per_minute: parseFloat((signalCount / minutes).toFixed(1))
		},
		recommendations: generateActivityRecs(signalCount, deviceCount, minutes)
	};
}

/** Resolve test location from args or latest signal in DB. */
async function resolveLocation(
	testLocation: { lat: number; lon: number } | undefined
): Promise<{ lat: number; lon: number } | null> {
	if (testLocation) return testLocation;
	const resp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({
			query: 'SELECT latitude, longitude FROM signals ORDER BY timestamp DESC LIMIT 1'
		})
	});
	const data = await resp.json();
	if (!data.success || data.results.length === 0) return null;
	return { lat: data.results[0].latitude, lon: data.results[0].longitude };
}

/** Run a timed benchmark query and return count + execution time. */
async function timedQuery(query: string): Promise<{ count: number; time: number }> {
	const start = Date.now();
	const resp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({ query })
	});
	const elapsed = Date.now() - start;
	const data = await resp.json();
	const count = data.success ? data.results[0]?.count || 0 : 0;
	return { count, time: elapsed };
}

/** Generate spatial index recommendations from benchmark results. */
function generateSpatialRecs(speedup: number, gridCount: number, fullCount: number): string[] {
	const recs: string[] = [];
	if (speedup < 2) {
		recs.push('Grid index not providing significant speedup - may be missing');
		recs.push('Check: EXPLAIN QUERY PLAN for spatial queries');
	} else {
		recs.push(`Grid index working (${speedup.toFixed(1)}x faster)`);
	}
	if (Math.abs(gridCount - fullCount) > 10) {
		recs.push('Grid query and full scan return different counts - potential index issue');
	}
	return recs;
}

/**
 * Debug the R-tree spatial index for location-based queries.
 */
export async function debugSpatialIndex(
	testLocation: { lat: number; lon: number } | undefined,
	radiusMeters: number
): Promise<Record<string, unknown>> {
	const loc = await resolveLocation(testLocation);
	if (!loc) {
		return { status: 'ERROR', error: 'No signals in database - cannot test spatial index' };
	}

	const gridLat = Math.floor(loc.lat * 10000);
	const gridLon = Math.floor(loc.lon * 10000);
	const gridRadius = Math.floor((radiusMeters / 1000) * 10000);

	const grid = await timedQuery(`
		SELECT COUNT(*) as count FROM signals
		WHERE CAST(latitude * 10000 AS INTEGER) >= ${gridLat - gridRadius}
		  AND CAST(latitude * 10000 AS INTEGER) <= ${gridLat + gridRadius}
		  AND CAST(longitude * 10000 AS INTEGER) >= ${gridLon - gridRadius}
		  AND CAST(longitude * 10000 AS INTEGER) <= ${gridLon + gridRadius}
	`);

	const full = await timedQuery(`
		SELECT COUNT(*) as count FROM signals
		WHERE latitude BETWEEN ${loc.lat - 0.01} AND ${loc.lat + 0.01}
		  AND longitude BETWEEN ${loc.lon - 0.01} AND ${loc.lon + 0.01}
	`);

	const speedup = full.time / Math.max(grid.time, 1);

	return {
		status: 'SUCCESS',
		test_location: loc,
		radius_meters: radiusMeters,
		results: {
			grid_indexed_query: { count: grid.count, execution_time_ms: grid.time },
			full_table_scan: { count: full.count, execution_time_ms: full.time },
			speedup: parseFloat(speedup.toFixed(2))
		},
		recommendations: generateSpatialRecs(speedup, grid.count, full.count)
	};
}
