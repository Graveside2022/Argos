/**
 * Database Optimizer
 * Advanced optimization strategies for SQLite performance
 */

import type { Database as DatabaseType } from 'better-sqlite3';

interface OptimizationConfig {
	// Performance tuning
	cacheSize: number; // Pages in cache (-2000 = 2MB)
	pageSize: number; // Database page size
	mmapSize: number; // Memory-mapped I/O size
	walMode: boolean; // Use Write-Ahead Logging
	synchronous: 'OFF' | 'NORMAL' | 'FULL';

	// Query optimization
	analyzeOnStart: boolean; // Run ANALYZE on startup
	autoIndex: boolean; // Allow automatic indexes
	queryPlanner: boolean; // Enable query planner stats

	// Memory limits
	tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
	tempStoreDirectory?: string;
	memoryLimit?: number; // Soft heap limit in bytes
}

interface QueryStats {
	query: string;
	count: number;
	totalTime: number;
	avgTime: number;
	lastRun: number;
}

export class DatabaseOptimizer {
	private db: DatabaseType;
	private config: OptimizationConfig;
	private queryStats: Map<string, QueryStats> = new Map();
	private optimizationTimer?: ReturnType<typeof setTimeout>;

	constructor(db: DatabaseType, config?: Partial<OptimizationConfig>) {
		this.db = db;
		this.config = {
			// Default optimizations for Raspberry Pi
			cacheSize: -2000, // 2MB cache
			pageSize: 4096, // 4KB pages
			mmapSize: 30000000, // 30MB mmap
			walMode: true,
			synchronous: 'NORMAL',
			analyzeOnStart: true,
			autoIndex: true,
			queryPlanner: false,
			tempStore: 'MEMORY',
			memoryLimit: 50 * 1024 * 1024, // 50MB soft limit
			...config
		};

		this.applyOptimizations();
	}

	/**
	 * Apply database optimizations
	 */
	private applyOptimizations() {
		// Cache configuration
		this.db.pragma(`cache_size = ${this.config.cacheSize}`);

		// WAL mode for better concurrency
		if (this.config.walMode) {
			this.db.pragma('journal_mode = WAL');
			this.db.pragma('wal_autocheckpoint = 1000'); // Checkpoint every 1000 pages
		}

		// Synchronous mode
		this.db.pragma(`synchronous = ${this.config.synchronous}`);

		// Memory-mapped I/O
		if (this.config.mmapSize > 0) {
			this.db.pragma(`mmap_size = ${this.config.mmapSize}`);
		}

		// Temporary storage
		this.db.pragma(`temp_store = ${this.config.tempStore}`);
		if (this.config.tempStoreDirectory) {
			this.db.pragma(`temp_store_directory = '${this.config.tempStoreDirectory}'`);
		}

		// Memory limit
		if (this.config.memoryLimit) {
			this.db.pragma(`soft_heap_limit = ${this.config.memoryLimit}`);
		}

		// Query planner
		if (this.config.queryPlanner) {
			this.db.pragma('query_only = 0');
		}

		// Auto-index
		this.db.pragma(`automatic_index = ${this.config.autoIndex ? 'ON' : 'OFF'}`);

		// Initial analysis
		if (this.config.analyzeOnStart) {
			this.analyze();
		}

		// Database optimizations applied
	}

	/**
	 * Analyze database statistics
	 */
	analyze() {
		// Analyzing database...
		const start = Date.now();
		this.db.exec('ANALYZE');
		const _duration = Date.now() - start;
		// Analysis completed in ${_duration}ms
	}

	/**
	 * Get current pragma settings
	 */
	getPragmaSettings() {
		const pragmas = [
			'cache_size',
			'page_size',
			'journal_mode',
			'synchronous',
			'mmap_size',
			'temp_store',
			'soft_heap_limit',
			'automatic_index',
			'wal_autocheckpoint',
			'page_count',
			'freelist_count'
		];

		const settings: Record<string, unknown> = {};

		for (const pragma of pragmas) {
			try {
				const result = this.db.pragma(pragma);
				settings[pragma] = result;
			} catch {
				// Some pragmas might not be available
			}
		}

		return settings;
	}

	/**
	 * Get index statistics and suggestions
	 */
	getIndexAnalysis() {
		// Get all indexes
		const indexes = this.db
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
			.all() as Array<{ index_name: string; table_name: string; sql: string }>;

		// Analyze index usage (approximate based on EXPLAIN QUERY PLAN)
		const analysis = indexes.map((index) => {
			// Check if index is used in common queries
			const usage = this.checkIndexUsage(index.table_name, index.index_name);

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

		// Suggest missing indexes
		const suggestions = this.suggestMissingIndexes();

		return {
			existing: analysis,
			suggestions
		};
	}

	/**
	 * Check index usage for a specific index
	 */
	private checkIndexUsage(_tableName: string, _indexName: string) {
		// This is a simplified check - in production, you'd analyze actual query plans
		// Common queries would be: SELECT/DELETE/UPDATE FROM ${tableName} WHERE

		let usageCount = 0;
		let totalQueries = 0;

		// Check if index columns are used in WHERE clauses
		// This is a heuristic - actual implementation would analyze EXPLAIN QUERY PLAN

		return {
			score: 0.5, // Default moderate usage
			usageCount,
			totalQueries
		};
	}

	/**
	 * Suggest missing indexes based on query patterns
	 */
	private suggestMissingIndexes() {
		const suggestions = [];

		// Check for missing indexes on foreign keys
		const foreignKeys = this.db
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
			.all() as Array<{ table_name: string; column_name: string; referenced_table: string }>;

		for (const fk of foreignKeys) {
			// Check if index exists on foreign key column
			const indexExists = this.db
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

		// Check for common query patterns without indexes
		// This would analyze actual query history in production

		return suggestions;
	}

	/**
	 * Optimize specific table
	 */
	optimizeTable(tableName: string) {
		// Optimizing table: ${tableName}

		// Rebuild the table to defragment
		this.db.exec(`VACUUM ${tableName}`);

		// Update statistics
		this.db.exec(`ANALYZE ${tableName}`);

		// Check and optimize indexes
		const indexes = this.db
			.prepare(
				`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' 
        AND tbl_name = ?
        AND name NOT LIKE 'sqlite_%'
    `
			)
			.all(tableName) as Array<{ name: string }>;

		for (const index of indexes) {
			this.db.exec(`REINDEX ${index.name}`);
		}

		// Table ${tableName} optimized
	}

	/**
	 * Get query execution plan
	 */
	explainQuery(query: string, params: unknown[] = []) {
		try {
			const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...(params as []));
			const stats = this.db.prepare(`EXPLAIN ${query}`).all(...(params as []));

			return {
				plan,
				stats,
				estimatedCost: this.estimateQueryCost(plan)
			};
		} catch (error) {
			return { error: (error as Error).message };
		}
	}

	/**
	 * Estimate query cost from execution plan
	 */
	private estimateQueryCost(plan: unknown[]) {
		let cost = 0;

		for (const step of plan) {
			const stepData = step as { detail?: string };
			if (stepData.detail) {
				if (stepData.detail.includes('SCAN TABLE')) cost += 1000;
				if (stepData.detail.includes('SEARCH TABLE')) cost += 100;
				if (stepData.detail.includes('USING INDEX')) cost += 10;
				if (stepData.detail.includes('USING COVERING INDEX')) cost += 5;
				if (stepData.detail.includes('TEMP B-TREE')) cost += 500;
			}
		}

		return cost;
	}

	/**
	 * Monitor query performance
	 */
	trackQuery(query: string, duration: number) {
		const stats = this.queryStats.get(query) || {
			query,
			count: 0,
			totalTime: 0,
			avgTime: 0,
			lastRun: 0
		};

		stats.count++;
		stats.totalTime += duration;
		stats.avgTime = stats.totalTime / stats.count;
		stats.lastRun = Date.now();

		this.queryStats.set(query, stats);
	}

	/**
	 * Get slow queries
	 */
	getSlowQueries(threshold: number = 100) {
		const slowQueries = Array.from(this.queryStats.values())
			.filter((stats) => stats.avgTime > threshold)
			.sort((a, b) => b.avgTime - a.avgTime);

		return slowQueries;
	}

	/**
	 * Optimize for specific workload
	 */
	optimizeForWorkload(workload: 'read_heavy' | 'write_heavy' | 'mixed') {
		switch (workload) {
			case 'read_heavy':
				// Optimize for reads
				this.db.pragma('cache_size = -4000'); // 4MB cache
				this.db.pragma('mmap_size = 268435456'); // 256MB mmap
				this.db.pragma('synchronous = NORMAL');
				this.db.pragma('page_size = 8192'); // Larger pages
				break;

			case 'write_heavy':
				// Optimize for writes
				this.db.pragma('cache_size = -1000'); // 1MB cache
				this.db.pragma('synchronous = OFF'); // Faster but less safe
				this.db.pragma('journal_mode = WAL');
				this.db.pragma('wal_autocheckpoint = 100'); // Frequent checkpoints
				break;

			case 'mixed':
				// Balanced optimization
				this.db.pragma('cache_size = -2000'); // 2MB cache
				this.db.pragma('synchronous = NORMAL');
				this.db.pragma('journal_mode = WAL');
				this.db.pragma('wal_autocheckpoint = 1000');
				break;
		}

		// Optimized for ${workload} workload
	}

	/**
	 * Get database health report
	 */
	getHealthReport() {
		const settings = this.getPragmaSettings();
		const dbSize = this.db
			.prepare(
				'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'
			)
			.get() as { size: number };
		const integrity = this.db.pragma('integrity_check');
		const quickCheck = this.db.pragma('quick_check');

		// Table statistics
		const tables = this.db
			.prepare(
				`
      SELECT 
        name,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
      FROM sqlite_master m
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `
			)
			.all();

		// Add row counts
		for (const table of tables) {
			try {
				const count = this.db
					.prepare(`SELECT COUNT(*) as count FROM ${(table as { name: string }).name}`)
					.get() as { count: number };
				(table as { row_count: number }).row_count = count.count;
			} catch {
				(table as { row_count: number }).row_count = -1;
			}
		}

		return {
			database_size: dbSize.size,
			settings,
			integrity: integrity === 'ok',
			quick_check: quickCheck === 'ok',
			tables,
			slow_queries: this.getSlowQueries(),
			recommendations: this.generateRecommendations(dbSize.size, tables)
		};
	}

	/**
	 * Generate optimization recommendations
	 */
	private generateRecommendations(dbSize: number, tables: unknown[]) {
		const recommendations = [];

		// Database size recommendations
		if (dbSize > 100 * 1024 * 1024) {
			// > 100MB
			recommendations.push({
				type: 'size',
				severity: 'medium',
				message: 'Consider implementing more aggressive data retention policies'
			});
		}

		// Table size recommendations
		for (const table of tables) {
			const tableData = table as { row_count: number; index_count: number; name: string };
			if (tableData.row_count > 100000 && tableData.index_count < 2) {
				recommendations.push({
					type: 'index',
					severity: 'high',
					message: `Table ${tableData.name} has ${tableData.row_count} rows but only ${tableData.index_count} indexes`
				});
			}
		}

		// Cache size recommendation
		const cacheSize = Math.abs((this.getPragmaSettings().cache_size as number) || 0);
		if (dbSize > cacheSize * 1024 * 10) {
			// Cache is < 10% of DB size
			recommendations.push({
				type: 'cache',
				severity: 'medium',
				message: 'Consider increasing cache_size for better performance'
			});
		}

		return recommendations;
	}
}
