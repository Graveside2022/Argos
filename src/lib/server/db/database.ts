/**
 * SQLite Database Service for RF Signal Storage
 * Provides efficient spatial queries and relationship tracking.
 *
 * This module is a thin facade that delegates to focused repositories:
 *   - signalRepository  : Signal CRUD (insert, batch, update, spatial search)
 *   - spatialRepository : Area statistics, nearby device queries
 *   - networkRepository : Network graph storage and retrieval
 *   - deviceService     : Device record creation and update
 *   - geo               : Pure geographic utility functions
 *   - types             : Shared TypeScript interfaces
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SignalMarker } from '$lib/stores/map/signals';
import type { NetworkNode, NetworkEdge } from '$lib/services/map/networkAnalyzer';
import type { Pattern as _Pattern } from '$lib/services/map/aiPatternDetector';
import { DatabaseCleanupService } from './cleanupService';
import { runMigrations } from './migrations/runMigrations';
import { logError, logWarn, logInfo } from '$lib/utils/logger';

// Repository / service imports
import * as signalRepo from './signalRepository';
import * as spatialRepo from './spatialRepository';
import * as networkRepo from './networkRepository';

// Re-export types for backward compatibility
export type {
	DbSignal,
	DbDevice,
	DbNetwork,
	DbRelationship,
	SpatialQuery,
	TimeQuery
} from './types';

import type { DbSignal, DbDevice, SpatialQuery, TimeQuery, DbRelationship } from './types';

class RFDatabase {
	private db: Database.Database;
	private statements: Map<string, Database.Statement> = new Map();
	private cleanupService: DatabaseCleanupService | null = null;

	constructor(dbPath: string = './rf_signals.db') {
		// Initialize database
		this.db = new Database(dbPath);
		this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
		this.db.pragma('synchronous = NORMAL'); // Balance between safety and speed

		// Memory management for Raspberry Pi - prevent unbounded memory growth
		this.db.pragma('cache_size = -64000'); // 64MB cache max (negative = KB)
		this.db.pragma('mmap_size = 134217728'); // 128MB memory-mapped I/O max
		this.db.pragma('temp_store = memory'); // Use memory for temporary tables
		this.db.pragma('page_size = 4096'); // Optimize page size for ARM

		// Load and execute schema
		try {
			const schemaPath = join(process.cwd(), 'src/lib/server/db/schema.sql');
			const schema = readFileSync(schemaPath, 'utf-8');
			this.db.exec(schema);
		} catch (error) {
			logError(
				'Failed to load schema, using embedded version',
				{ error },
				'schema-load-failed'
			);
			this.initializeSchema();
		}

		// Run migrations to update schema
		try {
			const migrationsPath = join(process.cwd(), 'src/lib/server/db/migrations');
			runMigrations(this.db, migrationsPath);
		} catch (error) {
			logWarn('Could not run migrations', { error }, 'migrations-failed');
		}

		// Prepare frequently used statements
		this.prepareStatements();

		// Initialize cleanup service (defer starting until after migrations)
		this.initializeCleanupService();
	}

	private initializeSchema() {
		// Embedded schema as fallback
		this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        manufacturer TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        avg_power REAL,
        freq_min REAL,
        freq_max REAL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signal_id TEXT UNIQUE NOT NULL,
        device_id TEXT,
        timestamp INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL DEFAULT 0,
        power REAL NOT NULL,
        frequency REAL NOT NULL,
        bandwidth REAL,
        modulation TEXT,
        source TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (device_id) REFERENCES devices(device_id)
      );

      CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
      CREATE INDEX IF NOT EXISTS idx_signals_location ON signals(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_signals_frequency ON signals(frequency);
      CREATE INDEX IF NOT EXISTS idx_signals_power ON signals(power);
      CREATE INDEX IF NOT EXISTS idx_signals_altitude ON signals(altitude);
      CREATE INDEX IF NOT EXISTS idx_signals_device ON signals(device_id);
      CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
      CREATE INDEX IF NOT EXISTS idx_signals_spatial_grid ON signals(
        CAST(latitude * 10000 AS INTEGER),
        CAST(longitude * 10000 AS INTEGER)
      );
    `);
	}

	private prepareStatements() {
		// Insert statements
		this.statements.set(
			'insertSignal',
			this.db.prepare(`
      INSERT INTO signals (
        signal_id, device_id, timestamp, latitude, longitude, altitude,
        power, frequency, bandwidth, modulation, source, metadata
      ) VALUES (
        @signal_id, @device_id, @timestamp, @latitude, @longitude, @altitude,
        @power, @frequency, @bandwidth, @modulation, @source, @metadata
      )
    `)
		);

		this.statements.set(
			'insertDevice',
			this.db.prepare(`
      INSERT OR REPLACE INTO devices (
        device_id, type, manufacturer, first_seen, last_seen,
        avg_power, freq_min, freq_max, metadata
      ) VALUES (
        @device_id, @type, @manufacturer, @first_seen, @last_seen,
        @avg_power, @freq_min, @freq_max, @metadata
      )
    `)
		);

		// Spatial queries
		this.statements.set(
			'findSignalsInRadius',
			this.db.prepare(`
      SELECT * FROM signals
      WHERE CAST(latitude * 10000 AS INTEGER) BETWEEN @lat_min AND @lat_max
        AND CAST(longitude * 10000 AS INTEGER) BETWEEN @lon_min AND @lon_max
        AND timestamp > @since
      ORDER BY timestamp DESC
      LIMIT @limit
    `)
		);

		this.statements.set(
			'findNearbyDevices',
			this.db.prepare(`
      SELECT DISTINCT d.*,
        AVG(s.latitude) as avg_lat,
        AVG(s.longitude) as avg_lon,
        COUNT(s.id) as signal_count
      FROM devices d
      JOIN signals s ON d.device_id = s.device_id
      WHERE CAST(s.latitude * 10000 AS INTEGER) BETWEEN @lat_min AND @lat_max
        AND CAST(s.longitude * 10000 AS INTEGER) BETWEEN @lon_min AND @lon_max
        AND s.timestamp > @since
      GROUP BY d.device_id
    `)
		);
	}

	// ── Signal operations (delegated to signalRepository) ──────────────

	/**
	 * Insert or update a signal
	 */
	insertSignal(signal: SignalMarker): DbSignal {
		return signalRepo.insertSignal(this.db, this.statements, signal);
	}

	/**
	 * Batch insert signals
	 */
	insertSignalsBatch(signals: SignalMarker[]): number {
		return signalRepo.insertSignalsBatch(this.db, this.statements, signals);
	}

	/**
	 * Find signals within radius of a point
	 */
	findSignalsInRadius(query: SpatialQuery & TimeQuery): SignalMarker[] {
		return signalRepo.findSignalsInRadius(this.db, this.statements, query);
	}

	// ── Spatial operations (delegated to spatialRepository) ────────────

	/**
	 * Find devices near a location
	 */
	findDevicesNearby(
		query: SpatialQuery & TimeQuery
	): Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }> {
		return spatialRepo.findDevicesNearby(this.db, this.statements, query);
	}

	/**
	 * Get signal statistics for an area
	 */
	getAreaStatistics(
		bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
		timeWindow: number = 3600000
	) {
		return spatialRepo.getAreaStatistics(this.db, bounds, timeWindow);
	}

	// ── Network operations (delegated to networkRepository) ────────────

	/**
	 * Store network relationships
	 */
	storeNetworkGraph(nodes: Map<string, NetworkNode>, edges: Map<string, NetworkEdge>) {
		return networkRepo.storeNetworkGraph(this.db, nodes, edges);
	}

	/**
	 * Get network relationships for visualization
	 */
	getNetworkRelationships(deviceIds?: string[]): DbRelationship[] {
		return networkRepo.getNetworkRelationships(this.db, deviceIds);
	}

	// ── Lifecycle & utilities ──────────────────────────────────────────

	/**
	 * Initialize cleanup service
	 */
	private initializeCleanupService() {
		try {
			this.cleanupService = new DatabaseCleanupService(this.db, {
				// Configure for 1-hour retention for signal data
				hackrfRetention: 60 * 60 * 1000, // 1 hour
				wifiRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
				defaultRetention: 60 * 60 * 1000, // 1 hour
				deviceRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
				patternRetention: 24 * 60 * 60 * 1000, // 24 hours
				cleanupInterval: 60 * 60 * 1000, // Run every hour
				aggregateInterval: 10 * 60 * 1000, // Aggregate every 10 minutes
				batchSize: 500, // Smaller batches for Pi
				maxRuntime: 20000 // 20 second max runtime
			});

			// Initialize the cleanup service (this will run migrations and prepare statements)
			this.cleanupService.initialize();

			// Start automatic cleanup
			this.cleanupService.start();
			logInfo(
				'Database cleanup service initialized and started',
				{},
				'cleanup-service-started'
			);
		} catch (error) {
			logError(
				'Failed to initialize cleanup service',
				{ error },
				'cleanup-service-init-failed'
			);
		}
	}

	/**
	 * Get cleanup service for manual operations
	 */
	getCleanupService(): DatabaseCleanupService | null {
		return this.cleanupService;
	}

	/**
	 * Get raw database instance for advanced operations
	 */
	get rawDb(): Database.Database {
		return this.db;
	}

	/**
	 * Cleanup and optimization
	 */
	vacuum() {
		this.db.exec('VACUUM');
	}

	close() {
		// Stop cleanup service
		if (this.cleanupService) {
			this.cleanupService.stop();
		}

		// better-sqlite3 statements don't need finalization
		this.statements.clear();
		this.db.close();
	}
}

// Singleton instance
let dbInstance: RFDatabase | null = null;

export function getRFDatabase(): RFDatabase {
	if (!dbInstance) {
		dbInstance = new RFDatabase();
	}
	return dbInstance;
}

// Cleanup on process termination
process.on('SIGTERM', () => {
	logInfo('SIGTERM received, closing database', {}, 'sigterm-database-close');
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
});

process.on('SIGINT', () => {
	logInfo('SIGINT received, closing database', {}, 'sigint-database-close');
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
});
