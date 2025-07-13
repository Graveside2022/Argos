/**
 * SQLite Database Service for RF Signal Storage
 * Provides efficient spatial queries and relationship tracking
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

export interface DbSignal {
	id?: number;
	signal_id: string;
	device_id?: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	altitude?: number;
	power: number;
	frequency: number;
	bandwidth?: number | null;
	modulation?: string | null;
	source: string;
	metadata?: string;
}

export interface DbDevice {
	id?: number;
	device_id: string;
	type: string;
	manufacturer?: string;
	first_seen: number;
	last_seen: number;
	avg_power?: number;
	freq_min?: number;
	freq_max?: number;
	metadata?: string;
}

export interface DbNetwork {
	id?: number;
	network_id: string;
	name?: string;
	type: string;
	encryption?: string;
	channel?: number;
	first_seen: number;
	last_seen: number;
	center_lat?: number;
	center_lon?: number;
	radius?: number;
}

export interface DbRelationship {
	id?: number;
	source_device_id: string;
	target_device_id: string;
	network_id?: string;
	relationship_type: string;
	strength?: number;
	first_seen: number;
	last_seen: number;
}

export interface SpatialQuery {
	lat: number;
	lon: number;
	radiusMeters: number;
}

export interface TimeQuery {
	startTime?: number;
	endTime?: number;
	limit?: number;
}

class RFDatabase {
	private db: Database.Database;
	private statements: Map<string, Database.Statement> = new Map();
	private cleanupService: DatabaseCleanupService | null = null;

	constructor(dbPath: string = './rf_signals.db') {
		// Initialize database
		this.db = new Database(dbPath);
		this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
		this.db.pragma('synchronous = NORMAL'); // Balance between safety and speed

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

	/**
	 * Insert or update a signal
	 */
	insertSignal(signal: SignalMarker): DbSignal {
		const dbSignal: DbSignal = {
			signal_id: signal.id,
			device_id: this.generateDeviceId(signal),
			timestamp: signal.timestamp,
			latitude: signal.lat,
			longitude: signal.lon,
			altitude: signal.altitude || 0,
			power: signal.power,
			frequency: signal.frequency,
			bandwidth: ('bandwidth' in signal ? signal.bandwidth : null) as number | null,
			modulation: ('modulation' in signal ? signal.modulation : null) as string | null,
			source: signal.source,
			metadata: signal.metadata ? JSON.stringify(signal.metadata) : undefined
		};

		try {
			// First ensure device exists
			this.ensureDeviceExists(dbSignal);

			const stmt = this.statements.get('insertSignal');
			if (!stmt) throw new Error('Insert signal statement not found');
			const info = stmt.run(dbSignal);
			dbSignal.id = info.lastInsertRowid as number;

			// Update device info
			this.updateDeviceFromSignal(dbSignal);

			return dbSignal;
		} catch (error) {
			if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
				// Signal already exists, update it
				return this.updateSignal(dbSignal);
			}
			throw error;
		}
	}

	/**
	 * Batch insert signals
	 */
	insertSignalsBatch(signals: SignalMarker[]): number {
		const insertSignal = this.statements.get('insertSignal');
		if (!insertSignal) throw new Error('Insert signal statement not found');
		const insertMany = this.db.transaction((signals: DbSignal[]) => {
			let successCount = 0;
			for (const signal of signals) {
				try {
					insertSignal.run(signal);
					successCount++;
				} catch (err) {
					// Log error but continue with other signals
					const error = err as Error;
					if (!error.message?.includes('UNIQUE constraint failed')) {
						logError(
							'Failed to insert signal',
							{ signalId: signal.signal_id, error: error.message },
							'signal-insert-failed'
						);
					}
				}
			}
			return successCount;
		});

		const dbSignals: DbSignal[] = signals.map((signal) => ({
			signal_id: signal.id,
			device_id: this.generateDeviceId(signal),
			timestamp: signal.timestamp,
			latitude: signal.lat,
			longitude: signal.lon,
			altitude: signal.altitude || 0,
			power: signal.power,
			frequency: signal.frequency,
			bandwidth:
				signal.metadata &&
				typeof signal.metadata === 'object' &&
				'bandwidth' in signal.metadata
					? (signal.metadata.bandwidth as number)
					: null,
			modulation:
				signal.metadata &&
				typeof signal.metadata === 'object' &&
				'modulation' in signal.metadata
					? (signal.metadata.modulation as string)
					: null,
			source: signal.source,
			metadata: signal.metadata ? JSON.stringify(signal.metadata) : undefined
		}));

		// Ensure all devices exist first
		const ensureDevices = this.db.transaction(() => {
			const processedDevices = new Set<string>();
			for (const dbSignal of dbSignals) {
				if (dbSignal.device_id && !processedDevices.has(dbSignal.device_id)) {
					this.ensureDeviceExists(dbSignal);
					processedDevices.add(dbSignal.device_id);
				}
			}
		});

		ensureDevices();

		try {
			const successCount = insertMany(dbSignals);

			// Update devices for successfully inserted signals
			const updateDevices = this.db.transaction(() => {
				const processedDevices = new Set<string>();
				for (const dbSignal of dbSignals) {
					if (dbSignal.device_id && !processedDevices.has(dbSignal.device_id)) {
						this.updateDeviceFromSignal(dbSignal);
						processedDevices.add(dbSignal.device_id);
					}
				}
			});

			updateDevices();

			return successCount;
		} catch (error) {
			logError('Batch insert transaction failed', { error }, 'batch-insert-failed');
			throw error;
		}
	}

	/**
	 * Find signals within radius of a point
	 */
	findSignalsInRadius(query: SpatialQuery & TimeQuery): SignalMarker[] {
		// Convert radius to grid units (approximately)
		const latRange = query.radiusMeters / 111320; // meters per degree
		const lonRange = query.radiusMeters / (111320 * Math.cos((query.lat * Math.PI) / 180));

		const lat_min = Math.floor((query.lat - latRange) * 10000);
		const lat_max = Math.ceil((query.lat + latRange) * 10000);
		const lon_min = Math.floor((query.lon - lonRange) * 10000);
		const lon_max = Math.ceil((query.lon + lonRange) * 10000);

		const stmt = this.statements.get('findSignalsInRadius');
		if (!stmt) throw new Error('Find signals in radius statement not found');
		const rows = stmt.all({
			lat_min,
			lat_max,
			lon_min,
			lon_max,
			since: query.startTime || 0,
			limit: query.limit || 1000
		}) as DbSignal[];

		// Convert to SignalMarker format and filter by exact distance
		return rows
			.map((row) => this.dbSignalToMarker(row))
			.filter((signal) => {
				const distance = this.calculateDistance(
					signal.lat,
					signal.lon,
					query.lat,
					query.lon
				);
				return distance <= query.radiusMeters;
			});
	}

	/**
	 * Find devices near a location
	 */
	findDevicesNearby(
		query: SpatialQuery & TimeQuery
	): Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }> {
		const latRange = query.radiusMeters / 111320;
		const lonRange = query.radiusMeters / (111320 * Math.cos((query.lat * Math.PI) / 180));

		const lat_min = Math.floor((query.lat - latRange) * 10000);
		const lat_max = Math.ceil((query.lat + latRange) * 10000);
		const lon_min = Math.floor((query.lon - lonRange) * 10000);
		const lon_max = Math.ceil((query.lon + lonRange) * 10000);

		const stmt = this.statements.get('findNearbyDevices');
		if (!stmt) throw new Error('Find nearby devices statement not found');
		return stmt.all({
			lat_min,
			lat_max,
			lon_min,
			lon_max,
			since: query.startTime || Date.now() - 300000 // Default: last 5 minutes
		}) as Array<DbDevice & { avg_lat: number; avg_lon: number; signal_count: number }>;
	}

	/**
	 * Get signal statistics for an area
	 */
	getAreaStatistics(
		bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
		timeWindow: number = 3600000
	) {
		const stmt = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT signal_id) as total_signals,
        COUNT(DISTINCT device_id) as unique_devices,
        AVG(power) as avg_power,
        MIN(power) as min_power,
        MAX(power) as max_power,
        MIN(frequency) as min_freq,
        MAX(frequency) as max_freq,
        COUNT(DISTINCT ROUND(frequency/100)*100) as freq_bands
      FROM signals
      WHERE latitude BETWEEN @minLat AND @maxLat
        AND longitude BETWEEN @minLon AND @maxLon
        AND timestamp > @since
    `);

		return stmt.get({
			minLat: bounds.minLat,
			maxLat: bounds.maxLat,
			minLon: bounds.minLon,
			maxLon: bounds.maxLon,
			since: Date.now() - timeWindow
		});
	}

	/**
	 * Store network relationships
	 */
	storeNetworkGraph(nodes: Map<string, NetworkNode>, edges: Map<string, NetworkEdge>) {
		const insertRelationship = this.db.prepare(`
      INSERT OR REPLACE INTO relationships (
        source_device_id, target_device_id, network_id,
        relationship_type, strength, first_seen, last_seen
      ) VALUES (
        @source_device_id, @target_device_id, @network_id,
        @relationship_type, @strength, @first_seen, @last_seen
      )
    `);

		const storeGraph = this.db.transaction(() => {
			edges.forEach((edge) => {
				insertRelationship.run({
					source_device_id: edge.source,
					target_device_id: edge.target,
					network_id: null, // TODO: Implement network detection
					relationship_type: edge.type,
					strength: edge.strength,
					first_seen: edge.metadata.lastSeen,
					last_seen: edge.metadata.lastSeen
				});
			});
		});

		storeGraph();
	}

	/**
	 * Get network relationships for visualization
	 */
	getNetworkRelationships(deviceIds?: string[]): DbRelationship[] {
		let query = `SELECT * FROM relationships`;
		let params: unknown[] = [];

		if (deviceIds && deviceIds.length > 0) {
			query += ` WHERE source_device_id IN (${deviceIds.map(() => '?').join(',')})
                    OR target_device_id IN (${deviceIds.map(() => '?').join(',')})`;
			params = [...deviceIds, ...deviceIds];
		}

		query += ` ORDER BY last_seen DESC LIMIT 1000`;

		const stmt = this.db.prepare(query);
		return stmt.all(...params) as DbRelationship[];
	}

	/**
	 * Helper methods
	 */
	private generateDeviceId(signal: SignalMarker): string {
		// Generate a device ID based on signal characteristics
		// In real implementation, this would use MAC address or other unique identifier
		const metadata = signal.metadata
			? typeof signal.metadata === 'string'
				? JSON.parse(signal.metadata)
				: signal.metadata
			: {};
		const signalType = metadata.signalType || metadata.type || 'unknown';
		return `${signalType}_${Math.floor(signal.frequency)}_${Math.floor(signal.power / 10) * 10}`;
	}

	private ensureDeviceExists(signal: DbSignal) {
		const existing = this.db
			.prepare('SELECT * FROM devices WHERE device_id = ?')
			.get(signal.device_id);

		if (!existing) {
			// Create new device
			const deviceType = this.detectDeviceType(signal);
			this.db
				.prepare(
					`
        INSERT INTO devices (
          device_id, type, first_seen, last_seen,
          avg_power, freq_min, freq_max
        ) VALUES (
          @device_id, @type, @timestamp, @timestamp,
          @power, @frequency, @frequency
        )
      `
				)
				.run({
					device_id: signal.device_id,
					type: deviceType,
					timestamp: signal.timestamp,
					power: signal.power,
					frequency: signal.frequency
				});
		}
	}

	private detectDeviceType(signal: DbSignal): string {
		// Simple device type detection based on frequency
		const freq = signal.frequency;
		if (freq >= 2400 && freq <= 2500) return 'wifi';
		if (freq >= 5150 && freq <= 5850) return 'wifi';
		if (freq >= 2400 && freq <= 2485) return 'bluetooth';
		if (freq >= 800 && freq <= 900) return 'cellular';
		if (freq >= 1800 && freq <= 1900) return 'cellular';
		return 'unknown';
	}

	private updateDeviceFromSignal(signal: DbSignal) {
		const stmt = this.statements.get('insertDevice');
		if (!stmt) throw new Error('Insert device statement not found');

		const existing = this.db
			.prepare('SELECT * FROM devices WHERE device_id = ?')
			.get(signal.device_id);

		if (existing) {
			// Update existing device
			// Use the trigger for average calculation or compute a simple running average
			this.db
				.prepare(
					`
        UPDATE devices SET
          last_seen = @timestamp,
          avg_power = (avg_power + @power) / 2,
          freq_min = MIN(freq_min, @frequency),
          freq_max = MAX(freq_max, @frequency)
        WHERE device_id = @device_id
      `
				)
				.run({
					device_id: signal.device_id,
					timestamp: signal.timestamp,
					power: signal.power,
					frequency: signal.frequency
				});
		} else {
			// Insert new device
			stmt.run({
				device_id: signal.device_id,
				type: this.detectDeviceType(signal),
				manufacturer: null, // TODO: OUI lookup
				first_seen: signal.timestamp,
				last_seen: signal.timestamp,
				avg_power: signal.power,
				freq_min: signal.frequency,
				freq_max: signal.frequency,
				metadata: signal.metadata
			});
		}
	}

	private updateSignal(signal: DbSignal): DbSignal {
		this.db
			.prepare(
				`
      UPDATE signals SET
        timestamp = @timestamp,
        latitude = @latitude,
        longitude = @longitude,
        power = @power
      WHERE signal_id = @signal_id
    `
			)
			.run(signal);

		return signal;
	}

	private dbSignalToMarker(dbSignal: DbSignal): SignalMarker {
		return {
			id: dbSignal.signal_id,
			lat: dbSignal.latitude,
			lon: dbSignal.longitude,
			power: dbSignal.power,
			frequency: dbSignal.frequency,
			timestamp: dbSignal.timestamp,
			source: dbSignal.source as SignalMarker['source'],
			metadata: dbSignal.metadata
				? (JSON.parse(dbSignal.metadata) as Record<string, unknown>)
				: {}
		};
	}

	private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371e3;
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

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
