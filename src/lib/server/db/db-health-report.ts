/**
 * Database Health Report
 * Extracted from DatabaseOptimizer — generates health reports and recommendations.
 */

import type { Database as DatabaseType } from 'better-sqlite3';

import { validateSqlIdentifier } from '$lib/server/security/input-sanitizer';

interface TableInfo {
	name: string;
	index_count: number;
	row_count: number;
}

interface Recommendation {
	type: string;
	severity: string;
	message: string;
}

interface QueryStats {
	query: string;
	count: number;
	totalTime: number;
	avgTime: number;
	lastRun: number;
}

/**
 * Get database health report, including integrity checks, table stats,
 * and optimization recommendations.
 */
export function getHealthReport(
	db: DatabaseType,
	pragmaSettings: Record<string, unknown>,
	slowQueries: QueryStats[]
) {
	// @constitutional-exemption Article-II-2.1 issue:#14 — SQLite pragma/query result type narrowing
	const dbSize = db
		.prepare(
			'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
		)
		// Safe: page_count * page_size SQL expression always returns single numeric 'size' column
		.get() as { size: number };
	const integrity = db.pragma('integrity_check');
	const quickCheck = db.pragma('quick_check');

	// Table statistics
	const tables = db
		.prepare(
			`
      SELECT
        name,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
      FROM sqlite_master m
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `
		)
		.all() as TableInfo[];

	// Add row counts
	for (const table of tables) {
		try {
			const safeTableName = validateSqlIdentifier(table.name, 'tableName');
			// @constitutional-exemption Article-II-2.1 issue:#14 — SQLite pragma/query result type narrowing
			const count = db
				.prepare(`SELECT COUNT(*) as count FROM ${safeTableName}`)
				// Safe: COUNT(*) always returns a single numeric column aliased as 'count'
				.get() as { count: number };
			table.row_count = count.count;
		} catch (_error: unknown) {
			table.row_count = -1;
		}
	}

	return {
		database_size: dbSize.size,
		settings: pragmaSettings,
		integrity: integrity === 'ok',
		quick_check: quickCheck === 'ok',
		tables,
		slow_queries: slowQueries,
		recommendations: generateRecommendations(dbSize.size, tables, pragmaSettings)
	};
}

/** Check for large database size recommendation. */
function checkDbSize(dbSize: number): Recommendation | null {
	if (dbSize <= 100 * 1024 * 1024) return null;
	return {
		type: 'size',
		severity: 'medium',
		message: 'Consider implementing more aggressive data retention policies'
	};
}

/** Check for under-indexed tables. */
function checkUnderIndexedTables(tables: TableInfo[]): Recommendation[] {
	return tables
		.filter((t) => t.row_count > 100000 && t.index_count < 2)
		.map((t) => ({
			type: 'index',
			severity: 'high',
			message: `Table ${t.name} has ${t.row_count} rows but only ${t.index_count} indexes`
		}));
}

/** Check for insufficient cache size. */
function checkCacheSize(
	dbSize: number,
	pragmaSettings: Record<string, unknown>
): Recommendation | null {
	const cacheSize = Math.abs((pragmaSettings.cache_size as number) || 0);
	if (dbSize <= cacheSize * 1024 * 10) return null;
	return {
		type: 'cache',
		severity: 'medium',
		message: 'Consider increasing cache_size for better performance'
	};
}

/** Generate optimization recommendations based on DB size and table stats */
function generateRecommendations(
	dbSize: number,
	tables: TableInfo[],
	pragmaSettings: Record<string, unknown>
): Recommendation[] {
	return [
		checkDbSize(dbSize),
		...checkUnderIndexedTables(tables),
		checkCacheSize(dbSize, pragmaSettings)
	].filter((r): r is Recommendation => r !== null);
}
