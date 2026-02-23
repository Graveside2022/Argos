/**
 * Data aggregation logic for the cleanup service
 * Extracted from DatabaseCleanupService to keep the main file within
 * the 300-line constitutional limit.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type Database from 'better-sqlite3';

import { logError, logInfo } from '$lib/utils/logger';

interface AggregationConfig {
	shouldAggregateHourly: boolean;
	shouldAggregateDaily: boolean;
}

/** Get a required prepared statement or throw. */
function getStmt(statements: Map<string, Database.Statement>, name: string): Database.Statement {
	const stmt = statements.get(name);
	if (!stmt) throw new Error(`${name} statement not found`);
	return stmt;
}

/** Run hourly signal and spatial heatmap aggregation. */
function aggregateHourly(
	statements: Map<string, Database.Statement>,
	lastHour: number,
	currentHour: number
): void {
	getStmt(statements, 'aggregateHourlySignals').run(lastHour, currentHour);
	getStmt(statements, 'aggregateSpatialHeatmap').run(lastHour, currentHour);
}

/** Run daily device aggregation. */
function aggregateDaily(
	statements: Map<string, Database.Statement>,
	lastDay: number,
	currentDay: number
): void {
	getStmt(statements, 'aggregateDailyDevices').run(lastDay, currentDay);
}

/** Run hourly and daily aggregation tasks */
export function runAggregation(
	db: DatabaseType,
	statements: Map<string, Database.Statement>,
	config: AggregationConfig
): void {
	const now = Date.now();
	const currentHour = Math.floor(now / 3600000) * 3600000;
	const currentDay = Math.floor(now / 86400000) * 86400000;

	try {
		db.transaction(() => {
			if (config.shouldAggregateHourly)
				aggregateHourly(statements, currentHour - 3600000, currentHour);
			if (config.shouldAggregateDaily)
				aggregateDaily(statements, currentDay - 86400000, currentDay);
		})();
		logInfo('Aggregation completed', {}, 'aggregation-completed');
	} catch (error) {
		logError('Aggregation failed', { error }, 'aggregation-failed');
	}
}

/** Export aggregated data for analysis */
export function exportAggregatedData(db: DatabaseType, startTime: number, endTime: number) {
	const hourlyStats = db
		.prepare(
			`
      SELECT * FROM signal_stats_hourly
      WHERE hour_timestamp >= ? AND hour_timestamp <= ?
      ORDER BY hour_timestamp
    `
		)
		.all(startTime, endTime);

	const dailyDevices = db
		.prepare(
			`
      SELECT * FROM device_stats_daily
      WHERE day_timestamp >= ? AND day_timestamp <= ?
      ORDER BY day_timestamp, device_id
    `
		)
		.all(startTime, endTime);

	const spatialData = db
		.prepare(
			`
      SELECT * FROM spatial_heatmap_hourly
      WHERE hour_timestamp >= ? AND hour_timestamp <= ?
      ORDER BY hour_timestamp, grid_lat, grid_lon
    `
		)
		.all(startTime, endTime);

	return { hourlyStats, dailyDevices, spatialData };
}

/** Cleanup old aggregated data */
export function cleanupAggregatedData(db: DatabaseType, daysToKeep: number = 30): void {
	const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

	const cleanup = db.transaction(() => {
		db.prepare('DELETE FROM signal_stats_hourly WHERE hour_timestamp < ?').run(cutoff);
		db.prepare('DELETE FROM device_stats_daily WHERE day_timestamp < ?').run(cutoff);
		db.prepare('DELETE FROM network_stats_daily WHERE day_timestamp < ?').run(cutoff);
		db.prepare('DELETE FROM spatial_heatmap_hourly WHERE hour_timestamp < ?').run(cutoff);
	});

	cleanup();
	logInfo('Cleaned up aggregated data', { daysToKeep }, 'aggregated-data-cleanup-completed');
}
