import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '$lib/utils/logger';

/**
 * Create the migrations tracking table if it does not already exist.
 */
function ensureMigrationsTable(db: Database.Database): void {
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
}

/**
 * Return the set of migration filenames that have already been applied.
 */
function getAppliedMigrations(db: Database.Database): Set<string> {
	const rows = db.prepare('SELECT filename FROM migrations').all() as Array<{
		filename: string;
	}>;
	return new Set(rows.map((row) => row.filename));
}

/**
 * Read the migrations directory and return sorted filenames for .sql and .ts files,
 * excluding the migration runner itself.
 */
function getMigrationFiles(migrationsPath: string): string[] {
	return readdirSync(migrationsPath)
		.filter(
			(file) =>
				(file.endsWith('.sql') || file.endsWith('.ts')) && file !== 'run-migrations.ts'
		)
		.sort();
}

/** Type guard for objects with code and message string properties. */
function isSqliteErrorLike(error: unknown): error is { code: string; message: string } {
	if (error === null || typeof error !== 'object') return false;
	const rec = error as Record<string, unknown>;
	return typeof rec.code === 'string' && typeof rec.message === 'string';
}

/**
 * Check whether a caught error is a SQLite duplicate-column error that can be safely ignored.
 */
function isDuplicateColumnError(error: unknown): boolean {
	return (
		isSqliteErrorLike(error) &&
		error.code === 'SQLITE_ERROR' &&
		error.message.includes('duplicate column name')
	);
}

/**
 * Execute a SQL migration file within a transaction, silently skipping
 * duplicate-column errors that indicate the migration was partially applied.
 */
function applySqlMigration(
	db: Database.Database,
	migrationsPath: string,
	filename: string,
	applyMigration: (filename: string, migrationFn: () => void) => void
): void {
	const sql = readFileSync(join(migrationsPath, filename), 'utf-8');
	applyMigration(filename, () => {
		try {
			db.exec(sql);
		} catch (error) {
			if (isDuplicateColumnError(error)) {
				logger.info('[migrations] Column already exists, skipping', { filename });
				return;
			}
			throw error;
		}
	});
}

/**
 * Dynamically import and execute a TypeScript migration file within a transaction.
 * The module must export a `migrate(db)` function.
 */
async function applyTsMigration(
	db: Database.Database,
	migrationsPath: string,
	filename: string,
	applyMigration: (filename: string, migrationFn: () => void) => void
): Promise<void> {
	try {
		const migrationModule: Record<string, unknown> = await import(
			join(migrationsPath, filename)
		);
		if (typeof migrationModule.migrate === 'function') {
			applyMigration(filename, () =>
				(migrationModule.migrate as (d: Database.Database) => void)(db)
			);
		} else {
			logger.error('[migrations] Migration does not export a migrate function', {
				filename
			});
		}
	} catch (error) {
		logger.error('[migrations] Failed to load TypeScript migration', {
			filename,
			error: String(error)
		});
		throw error;
	}
}

/**
 * Applies all pending SQL and TypeScript migrations in order, tracking each in a migrations table.
 * @param db The better-sqlite3 database connection
 * @param migrationsPath Absolute path to the directory containing migration files
 */
export async function runMigrations(db: Database.Database, migrationsPath: string) {
	ensureMigrationsTable(db);

	const appliedMigrations = getAppliedMigrations(db);
	const migrationFiles = getMigrationFiles(migrationsPath);

	const applyMigration = db.transaction((filename: string, migrationFn: () => void) => {
		try {
			migrationFn();
			db.prepare('INSERT INTO migrations (filename, applied_at) VALUES (?, ?)').run(
				filename,
				Date.now()
			);
			logger.info('[migrations] Migration applied', { filename });
		} catch (error) {
			logger.error('[migrations] Migration failed', { filename, error: String(error) });
			throw error;
		}
	});

	const pending = migrationFiles.filter((f) => !appliedMigrations.has(f));
	for (const filename of pending) {
		logger.info('[migrations] Applying migration', { filename });
		if (filename.endsWith('.sql')) {
			applySqlMigration(db, migrationsPath, filename, applyMigration);
		} else if (filename.endsWith('.ts')) {
			await applyTsMigration(db, migrationsPath, filename, applyMigration);
		}
	}
}
