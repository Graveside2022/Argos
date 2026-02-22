import { json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const db = getRFDatabase();
		const dbInternal = db.rawDb;

		// Get all tables
		const tables = dbInternal
			.prepare(
				`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
			)
			// Safe: sqlite_master schema guarantees column structure for this query
			.all() as Array<{ name: string; sql: string }>;

		// Get all indexes
		const indexes = dbInternal
			.prepare(
				`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name`
			)
			// Safe: sqlite_master schema guarantees column structure for this query
			.all() as Array<{ name: string; tbl_name: string; sql: string }>;

		// Get all views
		const views = dbInternal
			.prepare(
				`SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name`
			)
			// Safe: sqlite_master schema guarantees column structure for this query
			.all() as Array<{ name: string; sql: string }>;

		// Get table row counts
		const tableCounts: Record<string, number> = {};
		for (const table of tables) {
			try {
				const result = dbInternal
					.prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
					.get() as { count: number };
				tableCounts[table.name] = result.count;
			} catch {
				tableCounts[table.name] = 0;
			}
		}

		// Get database file size
		const dbSize = dbInternal.prepare(`SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()`).get() as { size: number };

		return json({
			success: true,
			schema: {
				tables: tables.map((t) => ({
					name: t.name,
					row_count: tableCounts[t.name],
					sql: t.sql
				})),
				indexes: indexes.map((i) => ({
					name: i.name,
					table: i.tbl_name,
					sql: i.sql
				})),
				views: views.map((v) => ({
					name: v.name,
					sql: v.sql
				}))
			},
			stats: {
				total_tables: tables.length,
				total_indexes: indexes.length,
				total_views: views.length,
				total_records: Object.values(tableCounts).reduce((sum, count) => sum + count, 0),
				database_size_bytes: dbSize.size
			}
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return json({
			success: false,
			error: msg
		});
	}
};
