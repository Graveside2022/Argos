import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';

/** Count rows per table, returning 0 on error. */
function getTableCounts(
	db: import('better-sqlite3').Database,
	tables: Array<{ name: string }>
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const table of tables) {
		try {
			const result = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {
				count: number;
			};
			counts[table.name] = result.count;
		} catch {
			counts[table.name] = 0;
		}
	}
	return counts;
}

export const GET = createHandler(async () => {
	try {
		const db = getRFDatabase().rawDb;

		const tables = db
			.prepare(
				`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
			)
			.all() as Array<{ name: string; sql: string }>;

		const indexes = db
			.prepare(
				`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name`
			)
			.all() as Array<{ name: string; tbl_name: string; sql: string }>;

		const views = db
			.prepare(`SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name`)
			.all() as Array<{ name: string; sql: string }>;

		const tableCounts = getTableCounts(db, tables);
		const dbSize = db
			.prepare(
				`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`
			)
			.get() as { size: number };

		return {
			success: true,
			schema: {
				tables: tables.map((t) => ({ name: t.name, row_count: tableCounts[t.name], sql: t.sql })),
				indexes: indexes.map((i) => ({ name: i.name, table: i.tbl_name, sql: i.sql })),
				views: views.map((v) => ({ name: v.name, sql: v.sql }))
			},
			stats: {
				total_tables: tables.length,
				total_indexes: indexes.length,
				total_views: views.length,
				total_records: Object.values(tableCounts).reduce((sum, c) => sum + c, 0),
				database_size_bytes: dbSize.size
			}
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, error: msg };
	}
});
