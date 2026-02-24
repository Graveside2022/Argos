/**
 * Signal repository: CRUD operations for the signals table.
 * All functions accept the db instance and prepared statements as parameters
 * to avoid coupling to the singleton.
 */

import type Database from 'better-sqlite3';

import { DbSignalSchema } from '$lib/schemas/database';
import { errMsg } from '$lib/server/api/error-utils';
import type { SignalMarker } from '$lib/types/signals';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import { ensureDeviceExists, updateDeviceFromSignal } from './device-service';
import { calculateDistance, convertRadiusToGrid, dbSignalToMarker, generateDeviceId } from './geo';
import type { DbSignal, SpatialQuery, TimeQuery } from './types';

/** Extract optional bandwidth from a signal's metadata. */
function extractBandwidth(signal: SignalMarker): number | null {
	if (!signal.metadata || typeof signal.metadata !== 'object') return null;
	return 'bandwidth' in signal.metadata ? ((signal.metadata.bandwidth as number) ?? null) : null;
}

/** Extract optional modulation from a signal's metadata. */
function extractModulation(signal: SignalMarker): string | null {
	if (!signal.metadata || typeof signal.metadata !== 'object') return null;
	return 'modulation' in signal.metadata
		? ((signal.metadata.modulation as string) ?? null)
		: null;
}

/** Convert a SignalMarker to a DbSignal for database insertion. */
function signalMarkerToDbSignal(signal: SignalMarker): DbSignal {
	return {
		signal_id: signal.id,
		device_id: generateDeviceId(signal),
		timestamp: signal.timestamp,
		latitude: signal.lat,
		longitude: signal.lon,
		altitude: signal.altitude || 0,
		power: signal.power,
		frequency: signal.frequency,
		bandwidth: extractBandwidth(signal),
		modulation: extractModulation(signal),
		source: signal.source,
		metadata: signal.metadata ? JSON.stringify(signal.metadata) : undefined
	};
}

/** Validate a DbSignal or throw. */
function validateSignalOrThrow(dbSignal: DbSignal): DbSignal {
	const validated = safeParseWithHandling(DbSignalSchema, dbSignal, 'background');
	if (!validated) throw new Error(`Invalid signal data for signal_id: ${dbSignal.signal_id}`);
	return validated;
}

/** Check if an error is a UNIQUE constraint violation. */
function isUniqueConstraintError(error: unknown): boolean {
	return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

/** Execute the insert, falling back to update on UNIQUE collision. */
function executeInsertOrUpdate(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	validated: DbSignal
): DbSignal {
	const stmt = statements.get('insertSignal');
	if (!stmt) throw new Error('Insert signal statement not found');
	const info = stmt.run(validated);
	validated.id = info.lastInsertRowid as number;
	updateDeviceFromSignal(db, statements, validated);
	return validated;
}

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
	const validated = validateSignalOrThrow(signalMarkerToDbSignal(signal));
	ensureDeviceExists(db, validated);
	try {
		return executeInsertOrUpdate(db, statements, validated);
	} catch (error) {
		if (isUniqueConstraintError(error)) return updateSignal(db, statements, validated);
		throw error;
	}
}

/** Validate an array of DbSignals, returning only valid ones and logging failures. */
function validateSignalBatch(dbSignals: DbSignal[]): DbSignal[] {
	return dbSignals.reduce<DbSignal[]>((acc, dbSignal) => {
		const validated = safeParseWithHandling(DbSignalSchema, dbSignal, 'background');
		if (validated) acc.push(validated);
		else
			logger.error(
				'Invalid signal data in batch, skipping',
				{ signal_id: dbSignal.signal_id },
				'signal-validation-failed'
			);
		return acc;
	}, []);
}

/** Process unique device IDs from signals using a callback. */
function forEachUniqueDevice(signals: DbSignal[], fn: (signal: DbSignal) => void): void {
	const seen = new Set<string>();
	for (const signal of signals) {
		if (signal.device_id && !seen.has(signal.device_id)) {
			fn(signal);
			seen.add(signal.device_id);
		}
	}
}

/** Try inserting a signal, silently skip UNIQUE conflicts, log other errors. */
function tryInsertSignal(stmt: Database.Statement, signal: DbSignal): boolean {
	try {
		stmt.run(signal);
		return true;
	} catch (err) {
		if (!isUniqueConstraintError(err)) {
			logger.error(
				'Failed to insert signal',
				{ signalId: signal.signal_id, error: errMsg(err) },
				'signal-insert-failed'
			);
		}
		return false;
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

	const validatedSignals = validateSignalBatch(signals.map(signalMarkerToDbSignal));
	if (validatedSignals.length === 0) {
		logger.error('All signals in batch failed validation', {}, 'batch-validation-failed');
		return 0;
	}

	db.transaction(() => forEachUniqueDevice(validatedSignals, (s) => ensureDeviceExists(db, s)))();

	const insertMany = db.transaction((sigs: DbSignal[]) => {
		return sigs.reduce((count, s) => count + (tryInsertSignal(insertStmt, s) ? 1 : 0), 0);
	});

	try {
		const successCount = insertMany(validatedSignals);
		db.transaction(() =>
			forEachUniqueDevice(validatedSignals, (s) => updateDeviceFromSignal(db, statements, s))
		)();
		return successCount;
	} catch (error) {
		logger.error('Batch insert transaction failed', { error }, 'batch-insert-failed');
		throw error;
	}
}

/**
 * Update an existing signal row (used when a UNIQUE constraint collision occurs).
 */
export function updateSignal(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	signal: DbSignal
): DbSignal {
	const validatedSignal = safeParseWithHandling(DbSignalSchema, signal, 'background');
	if (!validatedSignal) {
		throw new Error(`Invalid signal data for update: ${signal.signal_id}`);
	}

	const stmt = statements.get('updateSignal');
	if (stmt) {
		stmt.run(validatedSignal);
	} else {
		// Fallback for callers without cached statements
		db.prepare(
			`UPDATE signals SET timestamp = @timestamp, latitude = @latitude,
			 longitude = @longitude, power = @power WHERE signal_id = @signal_id`
		).run(validatedSignal);
	}

	return validatedSignal;
}

/**
 * Find signals within a given radius of a center point.
 * Uses the spatial grid index for an initial bounding-box filter,
 * then refines with Haversine distance.
 */
/** Validate raw DB rows as signals, logging invalid ones. */
function validateSignalRows(rawRows: unknown[]): DbSignal[] {
	return rawRows.reduce<DbSignal[]>((acc, row) => {
		const validated = safeParseWithHandling(DbSignalSchema, row, 'background');
		if (validated) acc.push(validated);
		else
			logger.error(
				'Invalid signal data returned from database query',
				{ row },
				'signal-query-validation-failed'
			);
		return acc;
	}, []);
}

/** Check if a signal is within the given radius from a center point. */
function isWithinRadius(signal: SignalMarker, query: SpatialQuery): boolean {
	return calculateDistance(signal.lat, signal.lon, query.lat, query.lon) <= query.radiusMeters;
}

export function findSignalsInRadius(
	_db: Database.Database,
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

	return validateSignalRows(rawRows)
		.map((row) => dbSignalToMarker(row))
		.filter((signal) => isWithinRadius(signal, query));
}
