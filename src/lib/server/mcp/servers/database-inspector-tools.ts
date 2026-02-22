/**
 * Database Inspector MCP Server — tool handler helpers.
 * Extracted from database-inspector.ts for constitutional compliance (Article 2.2).
 */

import { apiFetch } from '../shared/api-client';

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

	const signalsResp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({
			query: 'SELECT COUNT(*) as count FROM signals WHERE timestamp > ?',
			params: [timestamp]
		})
	});

	const signalsData = await signalsResp.json();
	const signalCount = signalsData.success ? signalsData.results[0]?.count || 0 : 0;

	const devicesResp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({
			query: 'SELECT COUNT(*) as count FROM devices WHERE last_seen > ?',
			params: [timestamp]
		})
	});

	const devicesData = await devicesResp.json();
	const deviceCount = devicesData.success ? devicesData.results[0]?.count || 0 : 0;

	const patternsResp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({
			query: 'SELECT COUNT(*) as count FROM patterns WHERE timestamp > ?',
			params: [timestamp]
		})
	});

	const patternsData = await patternsResp.json();
	const patternCount = patternsData.success ? patternsData.results[0]?.count || 0 : 0;

	const recommendations: string[] = [];

	if (signalCount === 0) {
		recommendations.push('No signals captured in last ' + minutes + ' minutes');
		recommendations.push('Check: Are hardware sources running? (HackRF, Kismet)');
	} else {
		const rate = (signalCount / minutes).toFixed(1);
		recommendations.push(`${signalCount} signals captured (${rate}/min)`);
	}

	if (deviceCount === 0 && signalCount > 0) {
		recommendations.push('Signals captured but no devices tracked');
	}

	return {
		status: 'SUCCESS',
		time_window_minutes: minutes,
		activity: {
			new_signals: signalCount,
			active_devices: deviceCount,
			new_patterns: patternCount,
			signal_rate_per_minute: parseFloat((signalCount / minutes).toFixed(1))
		},
		recommendations
	};
}

/**
 * Debug the R-tree spatial index for location-based queries.
 */
export async function debugSpatialIndex(
	testLocation: { lat: number; lon: number } | undefined,
	radiusMeters: number
): Promise<Record<string, unknown>> {
	let lat = 0;
	let lon = 0;

	if (testLocation) {
		lat = testLocation.lat;
		lon = testLocation.lon;
	} else {
		const latestResp = await apiFetch('/api/database/query', {
			method: 'POST',
			body: JSON.stringify({
				query: 'SELECT latitude, longitude FROM signals ORDER BY timestamp DESC LIMIT 1'
			})
		});

		const latestData = await latestResp.json();
		if (latestData.success && latestData.results.length > 0) {
			lat = latestData.results[0].latitude;
			lon = latestData.results[0].longitude;
		} else {
			return {
				status: 'ERROR',
				error: 'No signals in database - cannot test spatial index'
			};
		}
	}

	const gridLat = Math.floor(lat * 10000);
	const gridLon = Math.floor(lon * 10000);
	const gridRadius = Math.floor((radiusMeters / 1000) * 10000);

	const gridQuery = `
		SELECT COUNT(*) as count
		FROM signals
		WHERE CAST(latitude * 10000 AS INTEGER) >= ${gridLat - gridRadius}
		  AND CAST(latitude * 10000 AS INTEGER) <= ${gridLat + gridRadius}
		  AND CAST(longitude * 10000 AS INTEGER) >= ${gridLon - gridRadius}
		  AND CAST(longitude * 10000 AS INTEGER) <= ${gridLon + gridRadius}
	`;

	const gridStartTime = Date.now();
	const gridResp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({ query: gridQuery })
	});
	const gridTime = Date.now() - gridStartTime;
	const gridData = await gridResp.json();
	const gridCount = gridData.success ? gridData.results[0]?.count || 0 : 0;

	const fullQuery = `
		SELECT COUNT(*) as count
		FROM signals
		WHERE latitude BETWEEN ${lat - 0.01} AND ${lat + 0.01}
		  AND longitude BETWEEN ${lon - 0.01} AND ${lon + 0.01}
	`;

	const fullStartTime = Date.now();
	const fullResp = await apiFetch('/api/database/query', {
		method: 'POST',
		body: JSON.stringify({ query: fullQuery })
	});
	const fullTime = Date.now() - fullStartTime;
	const fullData = await fullResp.json();
	const fullCount = fullData.success ? fullData.results[0]?.count || 0 : 0;

	const recommendations: string[] = [];
	const speedup = fullTime / Math.max(gridTime, 1);

	if (speedup < 2) {
		recommendations.push('Grid index not providing significant speedup - may be missing');
		recommendations.push('Check: EXPLAIN QUERY PLAN for spatial queries');
	} else {
		recommendations.push(`Grid index working (${speedup.toFixed(1)}x faster)`);
	}

	if (Math.abs(gridCount - fullCount) > 10) {
		recommendations.push(
			'Grid query and full scan return different counts - potential index issue'
		);
	}

	return {
		status: 'SUCCESS',
		test_location: { lat, lon },
		radius_meters: radiusMeters,
		results: {
			grid_indexed_query: { count: gridCount, execution_time_ms: gridTime },
			full_table_scan: { count: fullCount, execution_time_ms: fullTime },
			speedup: parseFloat(speedup.toFixed(2))
		},
		recommendations
	};
}
