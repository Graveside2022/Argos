/**
 * SQLite Database Service for RF Signal Storage — thin facade that
 * delegates to signalRepository, spatialRepository, and networkRepository.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

import type { NetworkEdge, NetworkNode } from '$lib/types/network';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';

import { DatabaseCleanupService } from './cleanup-service';
import { runMigrations } from './migrations/run-migrations';
import * as networkRepo from './network-repository';
import * as signalRepo from './signal-repository';
import * as spatialRepo from './spatial-repository';

// ── Time duration constants (ms) ────────────────────────────────────
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const SEVEN_DAYS = 7 * ONE_DAY;
const TEN_MINUTES = 10 * 60 * 1000;

// NOTE: type re-exports removed — consumers import directly from './types'

import type { DbDevice, DbRelationship, DbSignal, SpatialQuery, TimeQuery } from './types';

export class RFDatabase {
	private db: Database.Database;
	private statements: Map<string, Database.Statement> = new Map();
	private cleanupService: DatabaseCleanupService | null = null;

	constructor(dbPath: string = './rf_signals.db') {
		this.db = new Database(dbPath);
		this.db.pragma('journal_mode = WAL');
		this.db.pragma('synchronous = NORMAL');
		this.db.pragma('cache_size = -64000'); // 64MB (negative = KB)
		this.db.pragma('mmap_size = 134217728'); // 128MB
		this.db.pragma('temp_store = memory');
		this.db.pragma('page_size = 4096');

		try {
			const schemaPath = join(process.cwd(), 'src/lib/server/db/schema.sql');
			this.db.exec(readFileSync(schemaPath, 'utf-8'));
		} catch (error) {
			logger.error('Failed to load schema, using embedded', { error }, 'schema-load-failed');
			this.initializeSchema();
		}

		try {
			runMigrations(this.db, join(process.cwd(), 'src/lib/server/db/migrations'));
		} catch (error) {
			logger.warn('Could not run migrations', { error }, 'migrations-failed');
		}

		this.prepareStatements();
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
		const p = (name: string, sql: string) => this.statements.set(name, this.db.prepare(sql));

		p(
			'insertSignal',
			`INSERT INTO signals (
			signal_id, device_id, timestamp, latitude, longitude, altitude,
			power, frequency, bandwidth, modulation, source, metadata
		) VALUES (
			@signal_id, @device_id, @timestamp, @latitude, @longitude, @altitude,
			@power, @frequency, @bandwidth, @modulation, @source, @metadata)`
		);

		p(
			'insertDevice',
			`INSERT OR REPLACE INTO devices (
			device_id, type, manufacturer, first_seen, last_seen,
			avg_power, freq_min, freq_max, metadata
		) VALUES (
			@device_id, @type, @manufacturer, @first_seen, @last_seen,
			@avg_power, @freq_min, @freq_max, @metadata)`
		);

		p(
			'findSignalsInRadius',
			`SELECT * FROM signals
			WHERE CAST(latitude * 10000 AS INTEGER) BETWEEN @lat_min AND @lat_max
			AND CAST(longitude * 10000 AS INTEGER) BETWEEN @lon_min AND @lon_max
			AND timestamp > @since ORDER BY timestamp DESC LIMIT @limit`
		);

		p(
			'findNearbyDevices',
			`SELECT DISTINCT d.*, AVG(s.latitude) as avg_lat,
			AVG(s.longitude) as avg_lon, COUNT(s.id) as signal_count
			FROM devices d JOIN signals s ON d.device_id = s.device_id
			WHERE CAST(s.latitude * 10000 AS INTEGER) BETWEEN @lat_min AND @lat_max
			AND CAST(s.longitude * 10000 AS INTEGER) BETWEEN @lon_min AND @lon_max
			AND s.timestamp > @since GROUP BY d.device_id`
		);

		p(
			'updateSignal',
			`UPDATE signals SET timestamp = @timestamp,
			latitude = @latitude, longitude = @longitude, power = @power
			WHERE signal_id = @signal_id`
		);
	}

	// ── Signal operations (delegated to signalRepository) ──────────────

	insertSignal(signal: SignalMarker): DbSignal {
		return signalRepo.insertSignal(this.db, this.statements, signal);
	}

	insertSignalsBatch(signals: SignalMarker[]): number {
		return signalRepo.insertSignalsBatch(this.db, this.statements, signals);
	}

	findSignalsInRadius(query: SpatialQuery & TimeQuery): SignalMarker[] {
		return signalRepo.findSignalsInRadius(this.db, this.statements, query);
	}

	// ── Spatial operations (delegated to spatialRepository) ────────────

	findDevicesNearby(
		query: SpatialQuery & TimeQuery
	): Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }> {
		return spatialRepo.findDevicesNearby(this.db, this.statements, query);
	}

	getAreaStatistics(
		bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
		timeWindow: number = ONE_HOUR
	) {
		return spatialRepo.getAreaStatistics(this.db, bounds, timeWindow);
	}

	// ── Network operations (delegated to networkRepository) ────────────

	storeNetworkGraph(nodes: Map<string, NetworkNode>, edges: Map<string, NetworkEdge>) {
		return networkRepo.storeNetworkGraph(this.db, nodes, edges);
	}

	getNetworkRelationships(deviceIds?: string[]): DbRelationship[] {
		return networkRepo.getNetworkRelationships(this.db, deviceIds);
	}

	// ── Lifecycle & utilities ──────────────────────────────────────────

	private initializeCleanupService() {
		try {
			this.cleanupService = new DatabaseCleanupService(this.db, {
				hackrfRetention: ONE_HOUR,
				wifiRetention: SEVEN_DAYS,
				defaultRetention: ONE_HOUR,
				deviceRetention: SEVEN_DAYS,
				patternRetention: ONE_DAY,
				cleanupInterval: ONE_HOUR,
				aggregateInterval: TEN_MINUTES,
				batchSize: 500,
				maxRuntime: 20000
			});
			this.cleanupService.initialize();
			this.cleanupService.start();
			logger.info('Database cleanup service started', {}, 'cleanup-service-started');
		} catch (error) {
			logger.error(
				'Failed to initialize cleanup service',
				{ error },
				'cleanup-service-init-failed'
			);
		}
	}

	getCleanupService(): DatabaseCleanupService | null {
		return this.cleanupService;
	}

	get rawDb(): Database.Database {
		return this.db;
	}

	vacuum() {
		this.db.exec('VACUUM');
	}

	close() {
		if (this.cleanupService) this.cleanupService.stop();
		this.statements.clear();
		this.db.close();
	}
}

// Singleton instance
let dbInstance: RFDatabase | null = null;

/** Returns the singleton RFDatabase instance, creating it on first call. */
export function getRFDatabase(): RFDatabase {
	if (!dbInstance) {
		dbInstance = new RFDatabase();
	}
	return dbInstance;
}

// Guarded via globalThis to prevent listener accumulation on Vite HMR reloads.
// globalThis.__argos_db_shutdown_registered is typed in src/app.d.ts.
if (!globalThis.__argos_db_shutdown_registered) {
	globalThis.__argos_db_shutdown_registered = true;

	const shutdownDb = (signal: string) => {
		logger.info(`${signal} received, closing database`, {}, 'database-shutdown');
		if (dbInstance) {
			dbInstance.close();
			dbInstance = null;
		}
	};

	for (const sig of ['SIGTERM', 'SIGINT'] as const) {
		process.on(sig, () => shutdownDb(sig));
	}
}
