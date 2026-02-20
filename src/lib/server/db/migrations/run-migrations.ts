import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { logger } from '$lib/utils/logger';

export async function runMigrations(db: Database.Database, migrationsPath: string) {
	// Create migrations tracking table if not exists
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

	// Get list of applied migrations
	const appliedMigrations = new Set(
		// Safe: migrations table has filename column — schema guaranteed
		(db.prepare('SELECT filename FROM migrations').all() as Array<{ filename: string }>).map(
			(row) => row.filename
		)
	);

	// Get all migration files (SQL and TypeScript, but exclude the migration runner itself)
	const migrationFiles = readdirSync(migrationsPath)
		.filter(
			(file) =>
				(file.endsWith('.sql') || file.endsWith('.ts')) && file !== 'run-migrations.ts'
		)
		.sort(); // Ensure migrations run in order

	// Apply pending migrations
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

	for (const filename of migrationFiles) {
		if (!appliedMigrations.has(filename)) {
			logger.info('[migrations] Applying migration', { filename });

			if (filename.endsWith('.sql')) {
				// SQL migration
				const sql = readFileSync(join(migrationsPath, filename), 'utf-8');
				applyMigration(filename, () => {
					try {
						db.exec(sql);
					} catch (error) {
						// Handle common SQLite errors that can be safely ignored
						if (
							error &&
							typeof error === 'object' &&
							'code' in error &&
							error.code === 'SQLITE_ERROR' &&
							'message' in error &&
							typeof error.message === 'string' &&
							error.message.includes('duplicate column name')
						) {
							logger.info('[migrations] Column already exists, skipping', {
								filename
							});
							return;
						}
						// Re-throw other errors
						throw error;
					}
				});
			} else if (filename.endsWith('.ts')) {
				// TypeScript migration
				try {
					const migrationModule = await import(join(migrationsPath, filename));
					if (migrationModule.migrate && typeof migrationModule.migrate === 'function') {
						applyMigration(filename, () => migrationModule.migrate(db));
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
		}
	}
}
