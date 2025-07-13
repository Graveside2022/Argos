import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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
		(db.prepare('SELECT filename FROM migrations').all() as Array<{ filename: string }>).map(
			(row) => row.filename
		)
	);

	// Get all migration files (SQL and TypeScript, but exclude the migration runner itself)
	const migrationFiles = readdirSync(migrationsPath)
		.filter(
			(file) => (file.endsWith('.sql') || file.endsWith('.ts')) && file !== 'runMigrations.ts'
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
			console.error(`Migration applied: ${filename}`);
		} catch (error) {
			console.error(`Migration failed: ${filename}`, error);
			throw error;
		}
	});

	for (const filename of migrationFiles) {
		if (!appliedMigrations.has(filename)) {
			console.error(`Applying migration: ${filename}`);

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
							console.error(`Column already exists in ${filename}, skipping...`);
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
						console.error(`Migration ${filename} does not export a migrate function`);
					}
				} catch (error) {
					console.error(`Failed to load TypeScript migration ${filename}:`, error);
					throw error;
				}
			}
		}
	}
}
