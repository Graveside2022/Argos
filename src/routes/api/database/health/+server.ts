import type Database from 'better-sqlite3';

import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';

interface HealthIssue {
	type: string;
	table: string;
	count?: number;
	severity: string;
	message: string;
}

/** Query a COUNT(*) and return the result. */
function queryCount(db: Database.Database, sql: string, params?: unknown[]): number {
	const row = params
		? (db.prepare(sql).get(...params) as { count: number })
		: (db.prepare(sql).get() as { count: number });
	return row.count;
}

/** Check for orphaned signals referencing non-existent devices. */
function checkOrphanedSignals(db: Database.Database): { issues: HealthIssue[]; recs: string[] } {
	const count = queryCount(
		db,
		`SELECT COUNT(*) as count FROM signals WHERE device_id IS NOT NULL AND device_id NOT IN (SELECT device_id FROM devices)`
	);
	if (count === 0) return { issues: [], recs: [] };
	return {
		issues: [{ type: 'orphaned_records', table: 'signals', count, severity: 'medium', message: `${count} signals reference non-existent devices` }],
		recs: ['💡 Clean up orphaned signals: DELETE FROM signals WHERE device_id NOT IN (SELECT device_id FROM devices)']
	};
}

/** Check for orphaned relationships. */
function checkOrphanedRelationships(db: Database.Database): { issues: HealthIssue[]; recs: string[] } {
	const count = queryCount(
		db,
		`SELECT COUNT(*) as count FROM relationships WHERE source_device_id NOT IN (SELECT device_id FROM devices) OR target_device_id NOT IN (SELECT device_id FROM devices)`
	);
	if (count === 0) return { issues: [], recs: [] };
	return {
		issues: [{ type: 'orphaned_records', table: 'relationships', count, severity: 'medium', message: `${count} relationships reference non-existent devices` }],
		recs: []
	};
}

/** Check for stale devices not seen in >7 days. */
function checkStaleDevices(db: Database.Database): { issues: HealthIssue[]; recs: string[] } {
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const count = queryCount(db, `SELECT COUNT(*) as count FROM devices WHERE last_seen < ?`, [sevenDaysAgo]);
	if (count <= 100) return { issues: [], recs: [] };
	return {
		issues: [{ type: 'stale_data', table: 'devices', count, severity: 'low', message: `${count} devices not seen in >7 days` }],
		recs: ['💡 Consider archiving old devices to reduce database size']
	};
}

/** Check if signals table is excessively large. */
function checkSignalTableSize(db: Database.Database): { issues: HealthIssue[]; recs: string[] } {
	const count = queryCount(db, `SELECT COUNT(*) as count FROM signals`);
	if (count <= 500000) return { issues: [], recs: [] };
	const severity = count > 1000000 ? 'high' : 'medium';
	return {
		issues: [{ type: 'large_table', table: 'signals', count, severity, message: `Signals table has ${count} records` }],
		recs: ['⚠️ Large signals table may impact performance - consider cleanup policy']
	};
}

/** Run PRAGMA integrity_check. */
function checkIntegrity(db: Database.Database): { ok: boolean; issues: HealthIssue[] } {
	try {
		const row = db.prepare(`PRAGMA integrity_check`).get() as { integrity_check: string };
		return { ok: row.integrity_check === 'ok', issues: [] };
	} catch {
		return { ok: false, issues: [{ type: 'integrity_check_failed', table: 'database', severity: 'high', message: 'Database integrity check failed' }] };
	}
}

const CRITICAL_INDEXES = ['idx_signals_timestamp', 'idx_signals_location', 'idx_signals_spatial_grid'];

/** Check if critical indexes exist. */
function checkIndexes(db: Database.Database): { issues: HealthIssue[]; recs: string[] } {
	const placeholders = CRITICAL_INDEXES.map(() => '?').join(',');
	const existing = db
		.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name IN (${placeholders})`)
		.all(...CRITICAL_INDEXES) as Array<{ name: string }>;
	const missing = CRITICAL_INDEXES.filter((idx) => !existing.some((e) => e.name === idx));
	if (missing.length === 0) return { issues: [], recs: [] };
	return {
		issues: [{ type: 'missing_indexes', table: 'signals', severity: 'high', message: `Missing critical indexes: ${missing.join(', ')}` }],
		recs: ['🔴 CRITICAL: Re-run schema.sql to create missing indexes']
	};
}

/** Classify overall health from issues. */
function classifyHealth(issues: HealthIssue[]): string {
	if (issues.some((i) => i.severity === 'high')) return 'CRITICAL';
	if (issues.some((i) => i.severity === 'medium')) return 'DEGRADED';
	return 'HEALTHY';
}

/** Count issues by severity. */
function countBySeverity(issues: HealthIssue[], severity: string): number {
	return issues.filter((i) => i.severity === severity).length;
}

export const GET = createHandler(async () => {
	try {
		const db = getRFDatabase().rawDb;

		const checks = [
			checkOrphanedSignals(db),
			checkOrphanedRelationships(db),
			checkStaleDevices(db),
			checkSignalTableSize(db),
			checkIndexes(db)
		];

		const issues = checks.flatMap((c) => c.issues);
		const recs = checks.flatMap((c) => c.recs);
		const integrity = checkIntegrity(db);
		issues.push(...integrity.issues);
		if (recs.length === 0 && issues.length === 0) recs.push('✅ Database health looks good');

		return {
			success: true,
			overall_health: classifyHealth(issues),
			integrity_ok: integrity.ok,
			issues,
			recommendations: recs,
			stats: {
				total_issues: issues.length,
				critical: countBySeverity(issues, 'high'),
				warnings: countBySeverity(issues, 'medium'),
				info: countBySeverity(issues, 'low')
			}
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, error: msg };
	}
});
