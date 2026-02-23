/**
 * Device service: creation and update of device records derived from signals.
 */

import type Database from 'better-sqlite3';

import { DbDeviceSchema } from '$lib/schemas/database';
import { logError } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import { detectDeviceType } from './geo';
import type { DbDevice, DbSignal } from './types';

/**
 * Ensure that a device record exists for the given signal's device_id.
 * If no row is found, inserts a new device using the signal's metadata.
 */
export function ensureDeviceExists(db: Database.Database, signal: DbSignal): void {
	const rawExisting = db
		.prepare('SELECT * FROM devices WHERE device_id = ?')
		.get(signal.device_id);

	// Validate existing device record if found (T036)
	if (rawExisting) {
		const validated = safeParseWithHandling(DbDeviceSchema, rawExisting, 'background');
		if (!validated) {
			logError(
				'Invalid device data in database',
				{ device_id: signal.device_id },
				'device-validation-failed'
			);
		}
		return; // Device exists (valid or invalid), don't insert duplicate
	}

	// No existing device, create new one
	const deviceType = detectDeviceType(signal.frequency);
	const newDeviceData = {
		device_id: signal.device_id,
		type: deviceType,
		first_seen: signal.timestamp,
		last_seen: signal.timestamp,
		avg_power: signal.power,
		freq_min: signal.frequency,
		freq_max: signal.frequency
	};

	// Validate new device data before insertion (T036)
	const validated = safeParseWithHandling(DbDeviceSchema, newDeviceData, 'background');
	if (!validated) {
		throw new Error(`Invalid device data for device_id: ${signal.device_id}`);
	}

	db.prepare(
		`
      INSERT INTO devices (
        device_id, type, first_seen, last_seen,
        avg_power, freq_min, freq_max
      ) VALUES (
        @device_id, @type, @first_seen, @last_seen,
        @avg_power, @freq_min, @freq_max
      )
    `
	).run(validated);
}

/** Fetch and validate an existing device record by device_id. */
function fetchExistingDevice(db: Database.Database, deviceId: string): DbDevice | undefined {
	const rawExisting = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(deviceId);
	if (!rawExisting) return undefined;
	const validated = safeParseWithHandling(DbDeviceSchema, rawExisting, 'background');
	if (!validated) {
		logError(
			'Invalid existing device data in database',
			{ device_id: deviceId },
			'device-validation-failed'
		);
	}
	return validated ?? undefined;
}

/** Update running statistics for an existing device record. */
function updateExistingDevice(db: Database.Database, signal: DbSignal): void {
	db.prepare(
		`UPDATE devices SET
			last_seen = @timestamp,
			avg_power = (avg_power + @power) / 2,
			freq_min = MIN(freq_min, @frequency),
			freq_max = MAX(freq_max, @frequency)
		WHERE device_id = @device_id`
	).run({
		device_id: signal.device_id,
		timestamp: signal.timestamp,
		power: signal.power,
		frequency: signal.frequency
	});
}

/** Insert a new device record derived from a signal observation. */
function insertNewDevice(statements: Map<string, Database.Statement>, signal: DbSignal): void {
	const newDeviceData = {
		device_id: signal.device_id,
		type: detectDeviceType(signal.frequency),
		manufacturer: undefined,
		first_seen: signal.timestamp,
		last_seen: signal.timestamp,
		avg_power: signal.power,
		freq_min: signal.frequency,
		freq_max: signal.frequency,
		metadata: signal.metadata
	};
	const validated = safeParseWithHandling(DbDeviceSchema, newDeviceData, 'background');
	if (!validated) throw new Error(`Invalid device data for device_id: ${signal.device_id}`);
	const stmt = statements.get('insertDevice');
	if (!stmt) throw new Error('Insert device statement not found');
	stmt.run(validated);
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
	const existing = fetchExistingDevice(db, signal.device_id!);
	if (existing) {
		updateExistingDevice(db, signal);
	} else {
		insertNewDevice(statements, signal);
	}
}
