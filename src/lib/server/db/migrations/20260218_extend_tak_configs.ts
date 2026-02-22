import type { Database } from 'better-sqlite3';

/** Adds truststore, cert password, and enrollment columns to tak_configs (idempotent). */
export function migrate(db: Database) {
	const columns = [
		'ALTER TABLE tak_configs ADD COLUMN truststore_path TEXT',
		"ALTER TABLE tak_configs ADD COLUMN truststore_pass TEXT DEFAULT 'atakatak'",
		"ALTER TABLE tak_configs ADD COLUMN cert_pass TEXT DEFAULT 'atakatak'",
		"ALTER TABLE tak_configs ADD COLUMN auth_method TEXT CHECK(auth_method IN ('enroll','import'))",
		'ALTER TABLE tak_configs ADD COLUMN enrollment_user TEXT',
		'ALTER TABLE tak_configs ADD COLUMN enrollment_pass TEXT',
		'ALTER TABLE tak_configs ADD COLUMN enrollment_port INTEGER DEFAULT 8446'
	];

	for (const sql of columns) {
		try {
			db.exec(sql);
		} catch (err) {
			// Skip if column already exists (idempotent migration)
			if (err instanceof Error && err.message.includes('duplicate column name')) {
				continue;
			}
			throw err;
		}
	}
}
