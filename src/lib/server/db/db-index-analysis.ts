/**
 * Database Index Analysis
 * Extracted from DatabaseOptimizer — analyzes index usage and suggests missing indexes.
 */

import type { Database as DatabaseType } from 'better-sqlite3';

interface IndexInfo {
	index_name: string;
	table_name: string;
	sql: string;
}

interface IndexUsage {
	score: number;
	usageCount: number;
	totalQueries: number;
}

interface IndexAnalysisResult {
	index_name: string;
	table_name: string;
	sql: string;
	usage: IndexUsage;
	recommendation: string;
}

interface IndexSuggestion {
	table: string;
	column: string;
	type: string;
	sql: string;
}

/**
 * Check index usage for a specific index (heuristic-based).
 * In production, this would analyze actual EXPLAIN QUERY PLAN output.
 */
function checkIndexUsage(_tableName: string, _indexName: string): IndexUsage {
	return {
		score: 0.5, // Default moderate usage
		usageCount: 0,
		totalQueries: 0
	};
}

/** Get index statistics and suggestions */
export function getIndexAnalysis(db: DatabaseType): {
	existing: IndexAnalysisResult[];
	suggestions: IndexSuggestion[];
} {
	// Get all indexes
	const indexes = db
		.prepare(
			`
      SELECT
        name as index_name,
        tbl_name as table_name,
        sql
      FROM sqlite_master
      WHERE type = 'index'
        AND name NOT LIKE 'sqlite_%'
    `
		)
		// Safe: sqlite_master schema guarantees name, tbl_name, sql columns for index entries
		.all() as IndexInfo[];

	// Analyze index usage
	const analysis = indexes.map((index) => {
		const usage = checkIndexUsage(index.table_name, index.index_name);

		return {
			index_name: index.index_name,
			table_name: index.table_name,
			sql: index.sql,
			usage,
			recommendation:
				usage.score < 0.1
					? 'Consider dropping'
					: usage.score > 0.8
						? 'Heavily used'
						: 'Moderate usage'
		};
	});

	const suggestions = suggestMissingIndexes(db);

	return { existing: analysis, suggestions };
}

/** Suggest missing indexes based on foreign key analysis */
function suggestMissingIndexes(db: DatabaseType): IndexSuggestion[] {
	const suggestions: IndexSuggestion[] = [];

	// Check for missing indexes on foreign keys
	const foreignKeys = db
		.prepare(
			`
      SELECT
        m.name as table_name,
        p.name as column_name,
        p."table" as referenced_table
      FROM sqlite_master m
      JOIN pragma_foreign_key_list(m.name) p
      WHERE m.type = 'table'
    `
		)
		// Safe: pragma_foreign_key_list returns name, table columns
		.all() as Array<{ table_name: string; column_name: string; referenced_table: string }>;

	for (const fk of foreignKeys) {
		const indexExists = db
			.prepare(
				`
        SELECT 1 FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = ?
          AND sql LIKE ?
      `
			)
			.get(fk.table_name, `%${fk.column_name}%`);

		if (!indexExists) {
			suggestions.push({
				table: fk.table_name,
				column: fk.column_name,
				type: 'foreign_key',
				sql: `CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON ${fk.table_name}(${fk.column_name})`
			});
		}
	}

	return suggestions;
}
