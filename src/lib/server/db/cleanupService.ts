/**
 * Database Cleanup Service
 * Implements automatic cleanup, data aggregation, and maintenance tasks
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { logInfo, logError, logWarn as _logWarn } from '$lib/utils/logger';

interface CleanupConfig {
	// Retention periods in milliseconds
	hackrfRetention: number; // High-frequency scan data
	wifiRetention: number; // WiFi/Kismet data
	defaultRetention: number; // Other signals
	deviceRetention: number; // Inactive devices
	patternRetention: number; // Pattern expiry

	// Aggregation intervals
	aggregateHourly: boolean;
	aggregateDaily: boolean;

	// Cleanup limits
	batchSize: number; // Records to process per batch
	maxRuntime: number; // Max cleanup runtime in ms

	// Schedule
	cleanupInterval: number; // How often to run cleanup (ms)
	aggregateInterval: number; // How often to run aggregation (ms)
}

export class DatabaseCleanupService {
	private db: DatabaseType;
	private config: CleanupConfig;
	private cleanupTimer?: ReturnType<typeof setTimeout>;
	private aggregateTimer?: ReturnType<typeof setTimeout>;
	private isRunning = false;
	private statements: Map<string, Database.Statement> = new Map();

	constructor(db: DatabaseType, config?: Partial<CleanupConfig>) {
		this.db = db;
		this.config = {
			// Default retention periods
			hackrfRetention: 60 * 60 * 1000, // 1 hour (changed from 24 hours)
			wifiRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
			defaultRetention: 60 * 60 * 1000, // 1 hour (changed from 3 days)
			deviceRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
			patternRetention: 24 * 60 * 60 * 1000, // 24 hours

			// Aggregation
			aggregateHourly: true,
			aggregateDaily: true,

			// Performance limits
			batchSize: 1000,
			maxRuntime: 30000, // 30 seconds

			// Schedule
			cleanupInterval: 60 * 60 * 1000, // Every hour
			aggregateInterval: 10 * 60 * 1000, // Every 10 minutes

			...config
		};

		// Don't prepare statements in constructor - defer until initialize() is called
		// This allows the main database to run migrations first
	}

	/**
	 * Initialize the cleanup service (prepare statements)
	 * This should be called after the main database migrations are complete
	 */
	initialize() {
		try {
			this.prepareStatements();
			logInfo(
				'Database cleanup service initialized successfully',
				{},
				'cleanup-service-initialized'
			);
		} catch (error) {
			logError(
				'Failed to initialize cleanup service',
				{ error },
				'cleanup-service-init-failed'
			);
			throw error;
		}
	}

	/**
	 * Prepare reusable statements
	 */
	private prepareStatements() {
		// Cleanup statements
		this.statements.set(
			'deleteOldSignals',
			this.db.prepare(`
      DELETE FROM signals 
      WHERE signal_id IN (
        SELECT signal_id FROM signals_to_delete LIMIT ?
      )
    `)
		);

		this.statements.set(
			'deleteInactiveDevices',
			this.db.prepare(`
      DELETE FROM devices 
      WHERE device_id IN (
        SELECT device_id FROM devices_to_delete LIMIT ?
      )
    `)
		);

		this.statements.set(
			'deleteOrphanedRelationships',
			this.db.prepare(`
      DELETE FROM relationships 
      WHERE id IN (
        SELECT id FROM relationships_to_delete LIMIT ?
      )
    `)
		);

		this.statements.set(
			'deleteExpiredPatterns',
			this.db.prepare(`
      DELETE FROM patterns 
      WHERE pattern_id IN (
        SELECT pattern_id FROM expired_patterns LIMIT ?
      )
    `)
		);

		// Aggregation statements
		this.statements.set(
			'aggregateHourlySignals',
			this.db.prepare(`
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

		this.statements.set(
			'aggregateDailyDevices',
			this.db.prepare(`
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
        0 as movement_distance -- TODO: Calculate actual movement
      FROM signals
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY CAST(timestamp / 86400000 AS INTEGER) * 86400000, device_id
    `)
		);

		this.statements.set(
			'aggregateSpatialHeatmap',
			this.db.prepare(`
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
	}

	/**
	 * Start automatic cleanup and aggregation
	 */
	start() {
		if (this.isRunning) return;

		// Ensure service is initialized before starting
		if (this.statements.size === 0) {
			this.initialize();
		}

		this.isRunning = true;

		// Run initial cleanup
		void this.runCleanup();
		void this.runAggregation();

		// Schedule periodic cleanup
		this.cleanupTimer = setInterval(() => {
			void this.runCleanup();
		}, this.config.cleanupInterval);

		// Schedule periodic aggregation
		this.aggregateTimer = setInterval(() => {
			void this.runAggregation();
		}, this.config.aggregateInterval);

		logInfo('Database cleanup service started', {}, 'cleanup-service-started');
	}

	/**
	 * Stop automatic cleanup
	 */
	stop() {
		this.isRunning = false;

		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}

		if (this.aggregateTimer) {
			clearInterval(this.aggregateTimer);
			this.aggregateTimer = undefined;
		}

		logInfo('Database cleanup service stopped', {}, 'cleanup-service-stopped');
	}

	/**
	 * Run cleanup tasks
	 */
	runCleanup() {
		const startTime = Date.now();
		const stats = {
			signals: 0,
			devices: 0,
			relationships: 0,
			patterns: 0,
			duration: 0
		};

		try {
			// Use transaction for consistency
			const cleanup = this.db.transaction(() => {
				// Delete old signals
				const signalStmt = this.statements.get('deleteOldSignals');
				if (!signalStmt) throw new Error('deleteOldSignals statement not found');
				let result = signalStmt.run(this.config.batchSize);
				stats.signals = result.changes;

				// Keep deleting in batches until done or timeout
				while (result.changes > 0 && Date.now() - startTime < this.config.maxRuntime) {
					result = signalStmt.run(this.config.batchSize);
					stats.signals += result.changes;
				}

				// Delete inactive devices
				const deviceStmt = this.statements.get('deleteInactiveDevices');
				if (!deviceStmt) throw new Error('deleteInactiveDevices statement not found');
				result = deviceStmt.run(this.config.batchSize);
				stats.devices = result.changes;

				// Delete orphaned relationships
				const relStmt = this.statements.get('deleteOrphanedRelationships');
				if (!relStmt) throw new Error('deleteOrphanedRelationships statement not found');
				result = relStmt.run(this.config.batchSize);
				stats.relationships = result.changes;

				// Delete expired patterns
				const patternStmt = this.statements.get('deleteExpiredPatterns');
				if (!patternStmt) throw new Error('deleteExpiredPatterns statement not found');
				result = patternStmt.run(this.config.batchSize);
				stats.patterns = result.changes;
			});

			cleanup();

			// Run VACUUM if significant data was deleted
			if (stats.signals + stats.devices > 1000) {
				this.db.exec('VACUUM');
			}

			stats.duration = Date.now() - startTime;
			logInfo('Cleanup completed', { stats }, 'cleanup-completed');

			return stats;
		} catch (error) {
			logError('Cleanup failed', { error }, 'cleanup-failed');
			throw error;
		}
	}

	/**
	 * Run aggregation tasks
	 */
	runAggregation() {
		const now = Date.now();
		const currentHour = Math.floor(now / 3600000) * 3600000;
		const currentDay = Math.floor(now / 86400000) * 86400000;

		try {
			const aggregate = this.db.transaction(() => {
				if (this.config.aggregateHourly) {
					// Aggregate last complete hour
					const lastHour = currentHour - 3600000;

					// Signal statistics
					const hourlyStmt = this.statements.get('aggregateHourlySignals');
					if (!hourlyStmt) throw new Error('aggregateHourlySignals statement not found');
					hourlyStmt.run(lastHour, currentHour);

					// Spatial heatmap
					const spatialStmt = this.statements.get('aggregateSpatialHeatmap');
					if (!spatialStmt)
						throw new Error('aggregateSpatialHeatmap statement not found');
					spatialStmt.run(lastHour, currentHour);
				}

				if (this.config.aggregateDaily) {
					// Aggregate last complete day
					const lastDay = currentDay - 86400000;

					// Device statistics
					const dailyStmt = this.statements.get('aggregateDailyDevices');
					if (!dailyStmt) throw new Error('aggregateDailyDevices statement not found');
					dailyStmt.run(lastDay, currentDay);
				}
			});

			aggregate();
			logInfo('Aggregation completed', {}, 'aggregation-completed');
		} catch (error) {
			logError('Aggregation failed', { error }, 'aggregation-failed');
		}
	}

	/**
	 * Get cleanup statistics
	 */
	getStats() {
		const stats = this.db
			.prepare(
				`
      SELECT 
        (SELECT COUNT(*) FROM signals) as total_signals,
        (SELECT COUNT(*) FROM signals_to_delete) as signals_to_delete,
        (SELECT COUNT(*) FROM devices) as total_devices,
        (SELECT COUNT(*) FROM devices_to_delete) as devices_to_delete,
        (SELECT COUNT(*) FROM relationships) as total_relationships,
        (SELECT COUNT(*) FROM relationships_to_delete) as relationships_to_delete,
        (SELECT COUNT(*) FROM patterns) as total_patterns,
        (SELECT COUNT(*) FROM expired_patterns) as patterns_to_delete,
        (SELECT SUM(row_count) FROM table_sizes) as total_records
    `
			)
			.get();

		return stats;
	}

	/**
	 * Get data growth trends
	 */
	getGrowthTrends(hours: number = 24) {
		const trends = this.db
			.prepare(
				`
      SELECT * FROM data_growth_hourly 
      ORDER BY hour DESC 
      LIMIT ?
    `
			)
			.all(hours);

		return trends;
	}

	/**
	 * Manual vacuum
	 */
	vacuum() {
		logInfo('Running VACUUM', {}, 'vacuum-start');
		const before = this.db
			.prepare(
				'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
			)
			.get() as { size: number };
		this.db.exec('VACUUM');
		const after = this.db
			.prepare(
				'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
			)
			.get() as { size: number };

		const saved = (before.size - after.size) / 1024 / 1024;
		logInfo('VACUUM completed', { spaceSavedMB: saved.toFixed(2) }, 'vacuum-completed');

		return { before: before.size, after: after.size, saved };
	}

	/**
	 * Analyze database and update statistics
	 */
	analyze() {
		this.db.exec('ANALYZE');
		logInfo('Database statistics updated', {}, 'database-analyze-completed');
	}

	/**
	 * Export aggregated data for analysis
	 */
	exportAggregatedData(startTime: number, endTime: number) {
		const hourlyStats = this.db
			.prepare(
				`
      SELECT * FROM signal_stats_hourly
      WHERE hour_timestamp >= ? AND hour_timestamp <= ?
      ORDER BY hour_timestamp
    `
			)
			.all(startTime, endTime);

		const dailyDevices = this.db
			.prepare(
				`
      SELECT * FROM device_stats_daily
      WHERE day_timestamp >= ? AND day_timestamp <= ?
      ORDER BY day_timestamp, device_id
    `
			)
			.all(startTime, endTime);

		const spatialData = this.db
			.prepare(
				`
      SELECT * FROM spatial_heatmap_hourly
      WHERE hour_timestamp >= ? AND hour_timestamp <= ?
      ORDER BY hour_timestamp, grid_lat, grid_lon
    `
			)
			.all(startTime, endTime);

		return {
			hourlyStats,
			dailyDevices,
			spatialData
		};
	}

	/**
	 * Cleanup old aggregated data
	 */
	cleanupAggregatedData(daysToKeep: number = 30) {
		const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

		const cleanup = this.db.transaction(() => {
			this.db.prepare('DELETE FROM signal_stats_hourly WHERE hour_timestamp < ?').run(cutoff);
			this.db.prepare('DELETE FROM device_stats_daily WHERE day_timestamp < ?').run(cutoff);
			this.db.prepare('DELETE FROM network_stats_daily WHERE day_timestamp < ?').run(cutoff);
			this.db
				.prepare('DELETE FROM spatial_heatmap_hourly WHERE hour_timestamp < ?')
				.run(cutoff);
		});

		cleanup();
		logInfo('Cleaned up aggregated data', { daysToKeep }, 'aggregated-data-cleanup-completed');
	}
}
