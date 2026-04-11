import type { Database } from 'better-sqlite3';

import type { GlobalProtectConfig } from '$lib/types/globalprotect';

const UPSERT_SQL = `
	INSERT INTO globalprotect_configs (id, portal, username, connect_on_startup)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		portal = excluded.portal,
		username = excluded.username,
		connect_on_startup = excluded.connect_on_startup
`;

interface GpConfigRow {
	id: string;
	portal: string;
	username: string;
	connect_on_startup: number;
}

function rowToConfig(row: GpConfigRow): GlobalProtectConfig {
	return {
		id: row.id,
		portal: row.portal,
		username: row.username,
		connectOnStartup: row.connect_on_startup === 1
	};
}

export function loadGpConfig(db: Database): GlobalProtectConfig | null {
	const row = db.prepare('SELECT * FROM globalprotect_configs LIMIT 1').get() as
		| GpConfigRow
		| undefined;
	return row ? rowToConfig(row) : null;
}

export function saveGpConfig(db: Database, config: GlobalProtectConfig): void {
	db.prepare(UPSERT_SQL).run(
		config.id,
		config.portal,
		config.username,
		config.connectOnStartup ? 1 : 0
	);
}
