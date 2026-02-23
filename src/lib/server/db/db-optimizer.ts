/**
 * Database Optimizer
 * Advanced optimization strategies for SQLite performance
 */

import type { Database as DatabaseType } from 'better-sqlite3';

import { errMsg } from '$lib/server/api/error-utils';
import { validateSqlIdentifier } from '$lib/server/security/input-sanitizer';

import { getHealthReport } from './db-health-report';
import { getIndexAnalysis } from './db-index-analysis';

interface OptimizationConfig {
	// Performance tuning
	cacheSize: number;
	pageSize: number;
	mmapSize: number;
	isWalMode: boolean;
	synchronous: 'OFF' | 'NORMAL' | 'FULL';

	// Query optimization
	shouldAnalyzeOnStart: boolean;
	shouldAutoIndex: boolean;
	shouldUseQueryPlanner: boolean;

	// Memory limits
	tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
	tempStoreDirectory?: string;
	memoryLimit?: number;
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

	constructor(db: DatabaseType, config?: Partial<OptimizationConfig>) {
		this.db = db;
		this.config = {
			cacheSize: -2000,
			pageSize: 4096,
			mmapSize: 30000000,
			isWalMode: true,
			synchronous: 'NORMAL',
			shouldAnalyzeOnStart: true,
			shouldAutoIndex: true,
			shouldUseQueryPlanner: false,
			tempStore: 'MEMORY',
			memoryLimit: 50 * 1024 * 1024,
			...config
		};

		this.applyOptimizations();
	}

	/** Conditional pragmas that depend on config flags. */
	private conditionalPragmas(): Array<[boolean, ...string[]]> {
		const c = this.config;
		return [
			[c.isWalMode, 'journal_mode = WAL', 'wal_autocheckpoint = 1000'],
			[c.mmapSize > 0, `mmap_size = ${c.mmapSize}`],
			[!!c.memoryLimit, `soft_heap_limit = ${c.memoryLimit}`],
			[c.shouldUseQueryPlanner, 'query_only = 0'],
			[
				!!c.tempStoreDirectory,
				`temp_store_directory = '${(c.tempStoreDirectory ?? '').replace(/'/g, "''")}'`
			]
		];
	}

	/** Build the list of pragma statements to apply based on config. */
	private buildPragmaList(): string[] {
		const c = this.config;
		const pragmas: string[] = [
			`cache_size = ${c.cacheSize}`,
			`synchronous = ${c.synchronous}`,
			`temp_store = ${c.tempStore}`,
			`automatic_index = ${c.shouldAutoIndex ? 'ON' : 'OFF'}`
		];
		for (const [enabled, ...stmts] of this.conditionalPragmas()) {
			if (enabled) pragmas.push(...stmts);
		}
		return pragmas;
	}

	/** Apply database optimizations */
	private applyOptimizations() {
		for (const pragma of this.buildPragmaList()) {
			this.db.pragma(pragma);
		}
		if (this.config.shouldAnalyzeOnStart) this.analyze();
	}

	/** Analyze database statistics */
	analyze() {
		this.db.exec('ANALYZE');
	}

	/** Get current pragma settings */
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
				settings[pragma] = this.db.pragma(pragma);
			} catch (_error: unknown) {
				// Some pragmas might not be available
			}
		}
		return settings;
	}

	/** Get index statistics and suggestions -- delegates to db-index-analysis */
	getIndexAnalysis() {
		return getIndexAnalysis(this.db);
	}

	/** Optimize specific table */
	optimizeTable(tableName: string) {
		const safeName = validateSqlIdentifier(tableName, 'tableName');
		this.db.exec(`VACUUM ${safeName}`);
		this.db.exec(`ANALYZE ${safeName}`);

		const indexes = this.db
			.prepare(
				`
      SELECT name FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = ?
        AND name NOT LIKE 'sqlite_%'
    `
			)
			// Safe: sqlite_master WHERE type='index' guarantees name column exists
			.all(tableName) as Array<{ name: string }>;

		for (const index of indexes) {
			const safeIndexName = validateSqlIdentifier(index.name, 'indexName');
			this.db.exec(`REINDEX ${safeIndexName}`);
		}
	}

	/** Get query execution plan */
	explainQuery(query: string, params: unknown[] = []) {
		try {
			// Safe: spread requires tuple type; params is unknown[] used as positional bind args
			const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...(params as []));
			const stats = this.db.prepare(`EXPLAIN ${query}`).all(...(params as []));

			return {
				plan,
				stats,
				estimatedCost: this.estimateQueryCost(plan)
			};
		} catch (error) {
			return { error: errMsg(error) };
		}
	}

	/** Cost weights for query plan operations. */
	private static readonly PLAN_COSTS: Array<{ pattern: string; cost: number }> = [
		{ pattern: 'SCAN TABLE', cost: 1000 },
		{ pattern: 'SEARCH TABLE', cost: 100 },
		{ pattern: 'TEMP B-TREE', cost: 500 },
		{ pattern: 'USING COVERING INDEX', cost: 5 },
		{ pattern: 'USING INDEX', cost: 10 }
	];

	/** Calculate the cost contribution of a single plan step. */
	private static stepCost(detail: string): number {
		return DatabaseOptimizer.PLAN_COSTS.reduce(
			(sum, entry) => sum + (detail.includes(entry.pattern) ? entry.cost : 0),
			0
		);
	}

	/** Estimate query cost from execution plan */
	private estimateQueryCost(plan: unknown[]) {
		return plan.reduce((cost: number, step) => {
			const detail = (step as { detail?: string }).detail;
			return detail ? cost + DatabaseOptimizer.stepCost(detail) : cost;
		}, 0);
	}

	/** Monitor query performance */
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

	/** Get slow queries */
	getSlowQueries(threshold: number = 100) {
		return Array.from(this.queryStats.values())
			.filter((stats) => stats.avgTime > threshold)
			.sort((a, b) => b.avgTime - a.avgTime);
	}

	/** Optimize for specific workload */
	optimizeForWorkload(workload: 'read_heavy' | 'write_heavy' | 'mixed') {
		switch (workload) {
			case 'read_heavy':
				this.db.pragma('cache_size = -4000');
				this.db.pragma('mmap_size = 268435456');
				this.db.pragma('synchronous = NORMAL');
				this.db.pragma('page_size = 8192');
				break;
			case 'write_heavy':
				this.db.pragma('cache_size = -1000');
				this.db.pragma('synchronous = OFF');
				this.db.pragma('journal_mode = WAL');
				this.db.pragma('wal_autocheckpoint = 100');
				break;
			case 'mixed':
				this.db.pragma('cache_size = -2000');
				this.db.pragma('synchronous = NORMAL');
				this.db.pragma('journal_mode = WAL');
				this.db.pragma('wal_autocheckpoint = 1000');
				break;
		}
	}

	/** Get database health report -- delegates to db-health-report */
	getHealthReport() {
		return getHealthReport(this.db, this.getPragmaSettings(), this.getSlowQueries());
	}
}
