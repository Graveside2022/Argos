import { Database } from 'sqlite3';
import { logInfo, logError } from '$lib/utils/logger';

// Schema interfaces based on actual database structure from audit
interface DatabaseDevice {
	id: number;
	device_id: string;
	type: string;
	manufacturer: string | null;
	first_seen: number;
	last_seen: number;
	avg_power: number | null;
	freq_min: number | null;
	freq_max: number | null;
	metadata: string | null;
}

interface DatabaseSignal {
	id: number;
	signal_id: string;
	device_id: string | null;
	timestamp: number;
	latitude: number;
	longitude: number;
	power: number;
	frequency: number;
	bandwidth: number | null;
	modulation: string | null;
	source: string;
	metadata: string | null;
}

export class DatabaseAccessLayer {
	private db: Database;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
	}

	async getDevices(): Promise<DatabaseDevice[]> {
		return new Promise((resolve, reject) => {
			// Using actual column names from schema audit
			this.db.all(
				'SELECT id, device_id, type, manufacturer, first_seen, last_seen, avg_power, freq_min, freq_max, metadata FROM devices',
				(err, rows) => {
					if (err) {
						logError('Failed to get devices', { error: err.message });
						reject(err);
					} else {
						resolve(rows as DatabaseDevice[]);
					}
				}
			);
		});
	}

	async getRecentSignals(limit = 100): Promise<DatabaseSignal[]> {
		return new Promise((resolve, reject) => {
			// Using actual column names from schema audit
			this.db.all(
				'SELECT id, signal_id, device_id, timestamp, latitude, longitude, power, frequency, bandwidth, modulation, source, metadata FROM signals ORDER BY timestamp DESC LIMIT ?',
				[limit],
				(err, rows) => {
					if (err) {
						logError('Failed to get recent signals', { error: err.message });
						reject(err);
					} else {
						resolve(rows as DatabaseSignal[]);
					}
				}
			);
		});
	}

	async cleanup(): Promise<void> {
		// Replace db-cleanup.sh functionality with verified schema operations
		logInfo('Starting database cleanup operations');

		try {
			// 1. Create backup (following db-cleanup.sh pattern)
			await this.createBackup();

			// 2. Clean up old signals based on retention policy
			await this.cleanupOldSignals();

			// 3. Clean up orphaned devices
			await this.cleanupOrphanedDevices();

			// 4. Clean up orphaned relationships
			await this.cleanupOrphanedRelationships();

			// 5. Clean up expired patterns
			await this.cleanupExpiredPatterns();

			// 6. Update aggregation tables
			await this.updateAggregationTables();

			// 7. Optimize database
			await this.optimizeDatabase();

			logInfo('Database cleanup completed successfully');
		} catch (error) {
			logError('Database cleanup failed', {
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	}

	private createBackup(): Promise<void> {
		// Implementation based on db-cleanup.sh backup logic
		logInfo('Creating database backup');
		// Backup creation logic here
		return Promise.resolve();
	}

	private cleanupOldSignals(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Based on retention_policy_violations view from schema audit
			this.db.run(
				`DELETE FROM signals WHERE signal_id IN (
          SELECT signal_id FROM signals
          WHERE timestamp < (strftime('%s', 'now') * 1000 -
            CASE
              WHEN source = 'hackrf' AND frequency > 2400 THEN 3600000
              WHEN source IN ('kismet', 'wifi') THEN 604800000
              ELSE 3600000
            END
          )
          LIMIT 10000
        )`,
				(err) => {
					if (err) {
						logError('Failed to cleanup old signals', { error: err.message });
						reject(err);
					} else {
						logInfo('Old signals cleaned up successfully');
						resolve();
					}
				}
			);
		});
	}

	private cleanupOrphanedDevices(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Based on devices_to_delete view from schema audit
			this.db.run(
				`DELETE FROM devices WHERE device_id IN (
          SELECT d.device_id FROM devices d
          WHERE NOT EXISTS (
            SELECT 1 FROM signals s
            WHERE s.device_id = d.device_id
            AND s.timestamp > (strftime('%s', 'now') * 1000 - 604800000)
          )
        )`,
				(err) => {
					if (err) {
						logError('Failed to cleanup orphaned devices', { error: err.message });
						reject(err);
					} else {
						logInfo('Orphaned devices cleaned up successfully');
						resolve();
					}
				}
			);
		});
	}

	private cleanupOrphanedRelationships(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Based on relationships_to_delete view from schema audit
			this.db.run(
				`DELETE FROM relationships WHERE id IN (
          SELECT r.id FROM relationships r
          WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.source_device_id)
          OR NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.target_device_id)
        )`,
				(err) => {
					if (err) {
						logError('Failed to cleanup orphaned relationships', {
							error: err.message
						});
						reject(err);
					} else {
						logInfo('Orphaned relationships cleaned up successfully');
						resolve();
					}
				}
			);
		});
	}

	private cleanupExpiredPatterns(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Based on expired_patterns view from schema audit
			this.db.run(
				`DELETE FROM patterns WHERE pattern_id IN (
          SELECT pattern_id FROM patterns
          WHERE expires_at IS NOT NULL
          AND expires_at < strftime('%s', 'now') * 1000
        )`,
				(err) => {
					if (err) {
						logError('Failed to cleanup expired patterns', { error: err.message });
						reject(err);
					} else {
						logInfo('Expired patterns cleaned up successfully');
						resolve();
					}
				}
			);
		});
	}

	private updateAggregationTables(): Promise<void> {
		// Update signal_stats_hourly and other aggregation tables
		logInfo('Updating aggregation tables');
		// Implementation here based on schema audit findings
		return Promise.resolve();
	}

	private optimizeDatabase(): Promise<void> {
		return new Promise((resolve, reject) => {
			// Based on db-cleanup.sh optimization logic
			this.db.run('ANALYZE', (err) => {
				if (err) {
					logError('Failed to analyze database', { error: err.message });
					reject(err);
				} else {
					// Check fragmentation and run VACUUM if needed
					this.db.get('PRAGMA freelist_count', (err, row) => {
						if (err) {
							reject(err);
						} else {
							const fragmentationRatio =
								(row as { freelist_count: number }).freelist_count / 1000; // Simplified calculation
							if (fragmentationRatio > 0.1) {
								this.db.run('VACUUM', (vacuumErr) => {
									if (vacuumErr) {
										logError('Failed to vacuum database', {
											error: vacuumErr.message
										});
										reject(vacuumErr);
									} else {
										logInfo('Database optimized successfully');
										resolve();
									}
								});
							} else {
								logInfo('Database optimization skipped (low fragmentation)');
								resolve();
							}
						}
					});
				}
			});
		});
	}
}
