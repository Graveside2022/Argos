/**
 * Device service: creation and update of device records derived from signals.
 */

import type Database from 'better-sqlite3';
import type { DbSignal } from './types';
import { detectDeviceType } from './geo';

/**
 * Ensure that a device record exists for the given signal's device_id.
 * If no row is found, inserts a new device using the signal's metadata.
 */
export function ensureDeviceExists(db: Database.Database, signal: DbSignal): void {
	const existing = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(signal.device_id);

	if (!existing) {
		const deviceType = detectDeviceType(signal.frequency);
		db.prepare(
			`
        INSERT INTO devices (
          device_id, type, first_seen, last_seen,
          avg_power, freq_min, freq_max
        ) VALUES (
          @device_id, @type, @timestamp, @timestamp,
          @power, @frequency, @frequency
        )
      `
		).run({
			device_id: signal.device_id,
			type: deviceType,
			timestamp: signal.timestamp,
			power: signal.power,
			frequency: signal.frequency
		});
	}
}

/**
 * Update an existing device's running statistics from a new signal observation,
 * or insert a new device if none exists yet.
 */
export function updateDeviceFromSignal(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	signal: DbSignal
): void {
	const existing = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(signal.device_id);

	if (existing) {
		// Update existing device running averages and frequency bounds
		db.prepare(
			`
        UPDATE devices SET
          last_seen = @timestamp,
          avg_power = (avg_power + @power) / 2,
          freq_min = MIN(freq_min, @frequency),
          freq_max = MAX(freq_max, @frequency)
        WHERE device_id = @device_id
      `
		).run({
			device_id: signal.device_id,
			timestamp: signal.timestamp,
			power: signal.power,
			frequency: signal.frequency
		});
	} else {
		// Insert new device via the prepared statement
		const stmt = statements.get('insertDevice');
		if (!stmt) throw new Error('Insert device statement not found');
		stmt.run({
			device_id: signal.device_id,
			type: detectDeviceType(signal.frequency),
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
