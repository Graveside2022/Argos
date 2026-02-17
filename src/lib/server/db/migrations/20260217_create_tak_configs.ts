import type { Database } from 'better-sqlite3';

export function migrate(db: Database) {
	db.exec(`
        CREATE TABLE IF NOT EXISTS tak_configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            hostname TEXT NOT NULL,
            port INTEGER NOT NULL DEFAULT 8089,
            protocol TEXT NOT NULL CHECK(protocol IN ('tcp', 'tls')),
            cert_path TEXT,
            key_path TEXT,
            ca_path TEXT,
            connect_on_startup INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        );
    `);
}
