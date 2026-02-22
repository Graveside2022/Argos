/**
 * Database Optimizer
 * Advanced optimization strategies for SQLite performance
 */

import type { Database as DatabaseType } from 'better-sqlite3';

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

	/** Apply database optimizations */
	private applyOptimizations() {
		this.db.pragma(`cache_size = ${this.config.cacheSize}`);

		if (this.config.isWalMode) {
			this.db.pragma('journal_mode = WAL');
			this.db.pragma('wal_autocheckpoint = 1000');
		}

		this.db.pragma(`synchronous = ${this.config.synchronous}`);

		if (this.config.mmapSize > 0) {
			this.db.pragma(`mmap_size = ${this.config.mmapSize}`);
		}

		this.db.pragma(`temp_store = ${this.config.tempStore}`);
		if (this.config.tempStoreDirectory) {
			this.db.pragma(
				`temp_store_directory = '${this.config.tempStoreDirectory.replace(/'/g, "''")}'`
			);
		}

		if (this.config.memoryLimit) {
			this.db.pragma(`soft_heap_limit = ${this.config.memoryLimit}`);
		}

		if (this.config.shouldUseQueryPlanner) {
			this.db.pragma('query_only = 0');
		}

		this.db.pragma(`automatic_index = ${this.config.shouldAutoIndex ? 'ON' : 'OFF'}`);

		if (this.config.shouldAnalyzeOnStart) {
			this.analyze();
		}
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
			return { error: (error as Error).message };
		}
	}

	/** Estimate query cost from execution plan */
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
