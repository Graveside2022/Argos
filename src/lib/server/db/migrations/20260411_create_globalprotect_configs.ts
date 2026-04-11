import type { Database } from 'better-sqlite3';

/** Creates the globalprotect_configs table for VPN connection settings. */
export function migrate(db: Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS globalprotect_configs (
			id TEXT PRIMARY KEY,
			portal TEXT NOT NULL DEFAULT '',
			username TEXT NOT NULL DEFAULT '',
			connect_on_startup INTEGER NOT NULL DEFAULT 0,
			auth_method TEXT NOT NULL DEFAULT 'password' CHECK(auth_method IN ('password', 'certificate')),
			certificate_path TEXT,
			created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
		);
	`);
}
