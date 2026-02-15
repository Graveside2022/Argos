/**
 * Signal repository: CRUD operations for the signals table.
 * All functions accept the db instance and prepared statements as parameters
 * to avoid coupling to the singleton.
 */

import type Database from 'better-sqlite3';

import { DbSignalSchema } from '$lib/schemas/database';
import type { SignalMarker } from '$lib/types/signals';
import { logError } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import { ensureDeviceExists, updateDeviceFromSignal } from './device-service';
import { calculateDistance, convertRadiusToGrid, dbSignalToMarker, generateDeviceId } from './geo';
import type { DbSignal, SpatialQuery, TimeQuery } from './types';

/**
 * Insert a single signal into the database.
 * Automatically creates/updates the associated device record.
 * On UNIQUE constraint collision, falls back to updateSignal.
 */
export function insertSignal(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	signal: SignalMarker
): DbSignal {
	const dbSignal: DbSignal = {
		signal_id: signal.id,
		device_id: generateDeviceId(signal),
		timestamp: signal.timestamp,
		latitude: signal.lat,
		longitude: signal.lon,
		altitude: signal.altitude || 0,
		power: signal.power,
		frequency: signal.frequency,
		// @constitutional-exemption Article-II-2.1 issue:#999 — Database query result type narrowing — better-sqlite3 returns generic objects
		bandwidth: ('bandwidth' in signal ? signal.bandwidth : null) as number | null,
		// @constitutional-exemption Article-II-2.1 issue:#999 — Database query result type narrowing — better-sqlite3 returns generic objects
		modulation: ('modulation' in signal ? signal.modulation : null) as string | null,
		source: signal.source,
		metadata: signal.metadata ? JSON.stringify(signal.metadata) : undefined
	};

	// Validate signal data before database insertion (T034)
	const validatedSignal = safeParseWithHandling(DbSignalSchema, dbSignal, 'background');
	if (!validatedSignal) {
		throw new Error(`Invalid signal data for signal_id: ${dbSignal.signal_id}`);
	}

	try {
		// First ensure device exists
		ensureDeviceExists(db, validatedSignal);

		const stmt = statements.get('insertSignal');
		if (!stmt) throw new Error('Insert signal statement not found');
		const info = stmt.run(validatedSignal);
		validatedSignal.id = info.lastInsertRowid as number;

		// Update device info
		updateDeviceFromSignal(db, statements, validatedSignal);

		return validatedSignal;
	} catch (error) {
		if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
			// Signal already exists, update it
			return updateSignal(db, validatedSignal);
		}
		throw error;
	}
}

/**
 * Batch insert multiple signals in a single transaction.
 * Returns the number of successfully inserted rows.
 */
export function insertSignalsBatch(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	signals: SignalMarker[]
): number {
	const insertStmt = statements.get('insertSignal');
	if (!insertStmt) throw new Error('Insert signal statement not found');

	const insertMany = db.transaction((dbSignals: DbSignal[]) => {
		let successCount = 0;
		for (const signal of dbSignals) {
			try {
				insertStmt.run(signal);
				successCount++;
			} catch (err) {
				// Safe: Catch block error from DB operations is always Error instance
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
		device_id: generateDeviceId(signal),
		timestamp: signal.timestamp,
		latitude: signal.lat,
		longitude: signal.lon,
		altitude: signal.altitude || 0,
		power: signal.power,
		frequency: signal.frequency,
		bandwidth:
			signal.metadata && typeof signal.metadata === 'object' && 'bandwidth' in signal.metadata
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

	// Validate all signals before batch insertion (T034)
	const validatedSignals: DbSignal[] = [];
	for (const dbSignal of dbSignals) {
		const validated = safeParseWithHandling(DbSignalSchema, dbSignal, 'background');
		if (validated) {
			validatedSignals.push(validated);
		} else {
			logError(
				'Invalid signal data in batch, skipping',
				{ signal_id: dbSignal.signal_id },
				'signal-validation-failed'
			);
		}
	}

	if (validatedSignals.length === 0) {
		logError('All signals in batch failed validation', {}, 'batch-validation-failed');
		return 0;
	}

	// Ensure all devices exist first
	const ensureDevices = db.transaction(() => {
		const processedDevices = new Set<string>();
		for (const dbSignal of validatedSignals) {
			if (dbSignal.device_id && !processedDevices.has(dbSignal.device_id)) {
				ensureDeviceExists(db, dbSignal);
				processedDevices.add(dbSignal.device_id);
			}
		}
	});

	ensureDevices();

	try {
		const successCount = insertMany(validatedSignals);

		// Update devices for successfully inserted signals
		const updateDevices = db.transaction(() => {
			const processedDevices = new Set<string>();
			for (const dbSignal of validatedSignals) {
				if (dbSignal.device_id && !processedDevices.has(dbSignal.device_id)) {
					updateDeviceFromSignal(db, statements, dbSignal);
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
 * Update an existing signal row (used when a UNIQUE constraint collision occurs).
 */
export function updateSignal(db: Database.Database, signal: DbSignal): DbSignal {
	// Validate signal data before update (T034)
	const validatedSignal = safeParseWithHandling(DbSignalSchema, signal, 'background');
	if (!validatedSignal) {
		throw new Error(`Invalid signal data for update: ${signal.signal_id}`);
	}

	db.prepare(
		`
      UPDATE signals SET
        timestamp = @timestamp,
        latitude = @latitude,
        longitude = @longitude,
        power = @power
      WHERE signal_id = @signal_id
    `
	).run(validatedSignal);

	return validatedSignal;
}

/**
 * Find signals within a given radius of a center point.
 * Uses the spatial grid index for an initial bounding-box filter,
 * then refines with Haversine distance.
 */
export function findSignalsInRadius(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	query: SpatialQuery & TimeQuery
): SignalMarker[] {
	const grid = convertRadiusToGrid(query.lat, query.lon, query.radiusMeters);

	const stmt = statements.get('findSignalsInRadius');
	if (!stmt) throw new Error('Find signals in radius statement not found');

	const rawRows = stmt.all({
		lat_min: grid.lat_min,
		lat_max: grid.lat_max,
		lon_min: grid.lon_min,
		lon_max: grid.lon_max,
		since: query.startTime || 0,
		limit: query.limit || 1000
	}) as unknown[];

	// Validate all returned rows (T034)
	const validatedRows: DbSignal[] = [];
	for (const row of rawRows) {
		const validated = safeParseWithHandling(DbSignalSchema, row, 'background');
		if (validated) {
			validatedRows.push(validated);
		} else {
			logError(
				'Invalid signal data returned from database query',
				{ row },
				'signal-query-validation-failed'
			);
		}
	}

	// Convert to SignalMarker format and filter by exact distance
	return validatedRows
		.map((row) => dbSignalToMarker(row))
		.filter((signal) => {
			const distance = calculateDistance(signal.lat, signal.lon, query.lat, query.lon);
			return distance <= query.radiusMeters;
		});
}
