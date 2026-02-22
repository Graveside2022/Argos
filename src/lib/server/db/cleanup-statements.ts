/**
 * Prepared statements for the database cleanup service
 * Extracted from DatabaseCleanupService to keep the main file within
 * the 300-line constitutional limit.
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type Database from 'better-sqlite3';

/** Prepare all reusable cleanup and aggregation statements */
export function prepareCleanupStatements(db: DatabaseType): Map<string, Database.Statement> {
	const statements = new Map<string, Database.Statement>();

	// Cleanup statements
	statements.set(
		'deleteOldSignals',
		db.prepare(`
      DELETE FROM signals
      WHERE signal_id IN (
        SELECT signal_id FROM signals_to_delete LIMIT ?
      )
    `)
	);

	statements.set(
		'deleteInactiveDevices',
		db.prepare(`
      DELETE FROM devices
      WHERE device_id IN (
        SELECT device_id FROM devices_to_delete LIMIT ?
      )
    `)
	);

	statements.set(
		'deleteOrphanedRelationships',
		db.prepare(`
      DELETE FROM relationships
      WHERE id IN (
        SELECT id FROM relationships_to_delete LIMIT ?
      )
    `)
	);

	statements.set(
		'deleteExpiredPatterns',
		db.prepare(`
      DELETE FROM patterns
      WHERE pattern_id IN (
        SELECT pattern_id FROM expired_patterns LIMIT ?
      )
    `)
	);

	// Aggregation statements
	statements.set(
		'aggregateHourlySignals',
		db.prepare(`
      INSERT OR REPLACE INTO signal_stats_hourly (
        hour_timestamp, total_signals, unique_devices,
        avg_power, min_power, max_power, dominant_frequency, coverage_area
      )
      SELECT
        CAST(timestamp / 3600000 AS INTEGER) * 3600000 as hour_timestamp,
        COUNT(*) as total_signals,
        COUNT(DISTINCT device_id) as unique_devices,
        AVG(power) as avg_power,
        MIN(power) as min_power,
        MAX(power) as max_power,
        AVG(frequency) as dominant_frequency,
        (MAX(latitude) - MIN(latitude)) * (MAX(longitude) - MIN(longitude)) * 111 * 111 as coverage_area
      FROM signals
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY CAST(timestamp / 3600000 AS INTEGER) * 3600000
    `)
	);

	statements.set(
		'aggregateDailyDevices',
		db.prepare(`
      INSERT OR REPLACE INTO device_stats_daily (
        day_timestamp, device_id, signal_count, avg_power,
        freq_min, freq_max, first_seen_hour, last_seen_hour,
        active_hours, avg_lat, avg_lon, movement_distance
      )
      SELECT
        CAST(timestamp / 86400000 AS INTEGER) * 86400000 as day_timestamp,
        device_id,
        COUNT(*) as signal_count,
        AVG(power) as avg_power,
        MIN(frequency) as freq_min,
        MAX(frequency) as freq_max,
        MIN(CAST(timestamp / 3600000 AS INTEGER)) as first_seen_hour,
        MAX(CAST(timestamp / 3600000 AS INTEGER)) as last_seen_hour,
        COUNT(DISTINCT CAST(timestamp / 3600000 AS INTEGER)) as active_hours,
        AVG(latitude) as avg_lat,
        AVG(longitude) as avg_lon,
        0 as movement_distance
      FROM signals
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY CAST(timestamp / 86400000 AS INTEGER) * 86400000, device_id
    `)
	);

	statements.set(
		'aggregateSpatialHeatmap',
		db.prepare(`
      INSERT OR REPLACE INTO spatial_heatmap_hourly (
        hour_timestamp, grid_lat, grid_lon, signal_count,
        unique_devices, avg_power, dominant_source
      )
      SELECT
        CAST(timestamp / 3600000 AS INTEGER) * 3600000 as hour_timestamp,
        CAST(latitude * 10000 AS INTEGER) as grid_lat,
        CAST(longitude * 10000 AS INTEGER) as grid_lon,
        COUNT(*) as signal_count,
        COUNT(DISTINCT device_id) as unique_devices,
        AVG(power) as avg_power,
        MIN(source) as dominant_source
      FROM signals
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY
        CAST(timestamp / 3600000 AS INTEGER) * 3600000,
        CAST(latitude * 10000 AS INTEGER),
        CAST(longitude * 10000 AS INTEGER)
    `)
	);

	return statements;
}
