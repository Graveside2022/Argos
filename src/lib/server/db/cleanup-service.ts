/**
 * Database Cleanup Service
 * Implements automatic cleanup, data aggregation, and maintenance tasks
 */

import type { Database as DatabaseType } from 'better-sqlite3';
import type Database from 'better-sqlite3';

import { logError, logInfo } from '$lib/utils/logger';

import {
	cleanupAggregatedData as doCleanupAggregatedData,
	exportAggregatedData as doExportAggregatedData,
	runAggregation as doRunAggregation
} from './cleanup-aggregation';
import { prepareCleanupStatements } from './cleanup-statements';

interface CleanupConfig {
	// Retention periods in milliseconds
	hackrfRetention: number;
	wifiRetention: number;
	defaultRetention: number;
	deviceRetention: number;
	patternRetention: number;

	// Aggregation intervals
	shouldAggregateHourly: boolean;
	shouldAggregateDaily: boolean;

	// Cleanup limits
	batchSize: number;
	maxRuntime: number;

	// Schedule
	cleanupInterval: number;
	aggregateInterval: number;
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
			hackrfRetention: 60 * 60 * 1000,
			wifiRetention: 7 * 24 * 60 * 60 * 1000,
			defaultRetention: 60 * 60 * 1000,
			deviceRetention: 7 * 24 * 60 * 60 * 1000,
			patternRetention: 24 * 60 * 60 * 1000,
			shouldAggregateHourly: true,
			shouldAggregateDaily: true,
			batchSize: 1000,
			maxRuntime: 30000,
			cleanupInterval: 60 * 60 * 1000,
			aggregateInterval: 10 * 60 * 1000,
			...config
		};
	}

	/** Initialize the cleanup service (prepare statements) */
	initialize() {
		try {
			this.statements = prepareCleanupStatements(this.db);
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

	/** Start automatic cleanup and aggregation */
	start() {
		if (this.isRunning) return;

		try {
			if (this.statements.size === 0) {
				this.initialize();
			}

			this.isRunning = true;
			void this.runCleanup();
			void this.runAggregation();

			this.cleanupTimer = setInterval(() => {
				void this.runCleanup();
			}, this.config.cleanupInterval);

			this.aggregateTimer = setInterval(() => {
				void this.runAggregation();
			}, this.config.aggregateInterval);

			logInfo('Database cleanup service started', {}, 'cleanup-service-started');
		} catch (error) {
			logError('Error starting cleanup service', { error }, 'cleanup-service-start-error');
			this.stop();
			throw error;
		}
	}

	/** Stop automatic cleanup */
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

	/** Get a required prepared statement or throw. */
	private getStmt(name: string): Database.Statement {
		const stmt = this.statements.get(name);
		if (!stmt) throw new Error(`${name} statement not found`);
		return stmt;
	}

	/** Delete old signals in batches until no more or max runtime exceeded. */
	private deleteSignalsBatched(startTime: number): number {
		const stmt = this.getStmt('deleteOldSignals');
		let total = 0;
		let result = stmt.run(this.config.batchSize);
		total += result.changes;
		while (result.changes > 0 && Date.now() - startTime < this.config.maxRuntime) {
			result = stmt.run(this.config.batchSize);
			total += result.changes;
		}
		return total;
	}

	/** Run cleanup tasks */
	runCleanup() {
		const startTime = Date.now();
		const stats = { signals: 0, devices: 0, relationships: 0, patterns: 0, duration: 0 };

		try {
			this.db.transaction(() => {
				stats.signals = this.deleteSignalsBatched(startTime);
				stats.devices = this.getStmt('deleteInactiveDevices').run(
					this.config.batchSize
				).changes;
				stats.relationships = this.getStmt('deleteOrphanedRelationships').run(
					this.config.batchSize
				).changes;
				stats.patterns = this.getStmt('deleteExpiredPatterns').run(
					this.config.batchSize
				).changes;
			})();

			if (stats.signals + stats.devices > 10000) this.db.exec('VACUUM');
			stats.duration = Date.now() - startTime;
			logInfo('Cleanup completed', { stats }, 'cleanup-completed');
			return stats;
		} catch (error) {
			logError('Cleanup failed', { error }, 'cleanup-failed');
			throw error;
		}
	}

	/** Run aggregation tasks -- delegates to cleanup-aggregation module */
	runAggregation() {
		doRunAggregation(this.db, this.statements, {
			shouldAggregateHourly: this.config.shouldAggregateHourly,
			shouldAggregateDaily: this.config.shouldAggregateDaily
		});
	}

	/** Get cleanup statistics */
	getStats() {
		return this.db
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
	}

	/** Get data growth trends */
	getGrowthTrends(hours: number = 24) {
		return this.db
			.prepare('SELECT * FROM data_growth_hourly ORDER BY hour DESC LIMIT ?')
			.all(hours);
	}

	/** Manual vacuum */
	vacuum() {
		logInfo('Running VACUUM', {}, 'vacuum-start');
		// Safe: page_count * page_size always returns a single numeric 'size' column
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

	/** Analyze database and update statistics */
	analyze() {
		this.db.exec('ANALYZE');
		logInfo('Database statistics updated', {}, 'database-analyze-completed');
	}

	/** Export aggregated data for analysis -- delegates to cleanup-aggregation */
	exportAggregatedData(startTime: number, endTime: number) {
		return doExportAggregatedData(this.db, startTime, endTime);
	}

	/** Cleanup old aggregated data -- delegates to cleanup-aggregation */
	cleanupAggregatedData(daysToKeep: number = 30) {
		doCleanupAggregatedData(this.db, daysToKeep);
	}
}
