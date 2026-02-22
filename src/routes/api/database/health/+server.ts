import { json } from '@sveltejs/kit';

import { getRFDatabase } from '$lib/server/db/database';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const db = getRFDatabase();
		const dbInternal = db.rawDb;

		const issues = [];
		const recommendations = [];

		// Check for orphaned signals (signals without devices)
		const orphanedSignals = dbInternal
			.prepare(
				`SELECT COUNT(*) as count FROM signals WHERE device_id IS NOT NULL AND device_id NOT IN (SELECT device_id FROM devices)`
			)
			.get() as { count: number };

		if (orphanedSignals.count > 0) {
			issues.push({
				type: 'orphaned_records',
				table: 'signals',
				count: orphanedSignals.count,
				severity: 'medium',
				message: `${orphanedSignals.count} signals reference non-existent devices`
			});
			recommendations.push(
				'💡 Clean up orphaned signals: DELETE FROM signals WHERE device_id NOT IN (SELECT device_id FROM devices)'
			);
		}

		// Check for orphaned relationships
		const orphanedRelationships = dbInternal
			.prepare(
				`SELECT COUNT(*) as count FROM relationships WHERE source_device_id NOT IN (SELECT device_id FROM devices) OR target_device_id NOT IN (SELECT device_id FROM devices)`
			)
			.get() as { count: number };

		if (orphanedRelationships.count > 0) {
			issues.push({
				type: 'orphaned_records',
				table: 'relationships',
				count: orphanedRelationships.count,
				severity: 'medium',
				message: `${orphanedRelationships.count} relationships reference non-existent devices`
			});
		}

		// Check for stale devices (not seen in >7 days)
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		const staleDevices = dbInternal
			.prepare(`SELECT COUNT(*) as count FROM devices WHERE last_seen < ?`)
			.get(sevenDaysAgo) as { count: number };

		if (staleDevices.count > 100) {
			issues.push({
				type: 'stale_data',
				table: 'devices',
				count: staleDevices.count,
				severity: 'low',
				message: `${staleDevices.count} devices not seen in >7 days`
			});
			recommendations.push('💡 Consider archiving old devices to reduce database size');
		}

		// Check for large signal table
		const signalCount = dbInternal
			.prepare(`SELECT COUNT(*) as count FROM signals`)
			.get() as { count: number };

		if (signalCount.count > 500000) {
			issues.push({
				type: 'large_table',
				table: 'signals',
				count: signalCount.count,
				severity: signalCount.count > 1000000 ? 'high' : 'medium',
				message: `Signals table has ${signalCount.count} records`
			});
			recommendations.push(
				'⚠️ Large signals table may impact performance - consider cleanup policy'
			);
		}

		// Check database integrity
		let integrityOk = false;
		try {
			const integrityCheck = dbInternal.prepare(`PRAGMA integrity_check`).get() as { integrity_check: string };
			integrityOk = integrityCheck.integrity_check === 'ok';
		} catch {
			issues.push({
				type: 'integrity_check_failed',
				table: 'database',
				severity: 'high',
				message: 'Database integrity check failed'
			});
		}

		// Check if indexes exist on critical columns
		const criticalIndexes = [
			'idx_signals_timestamp',
			'idx_signals_location',
			'idx_signals_spatial_grid'
		];

		const existingIndexes = dbInternal
			.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name IN (${criticalIndexes.map(() => '?').join(',')})`)
			// Safe: sqlite_master WHERE type='index' guarantees name column
			.all(...criticalIndexes) as Array<{ name: string }>;

		const missingIndexes = criticalIndexes.filter(
			(idx) => !existingIndexes.some((e) => e.name === idx)
		);

		if (missingIndexes.length > 0) {
			issues.push({
				type: 'missing_indexes',
				table: 'signals',
				severity: 'high',
				message: `Missing critical indexes: ${missingIndexes.join(', ')}`
			});
			recommendations.push('🔴 CRITICAL: Re-run schema.sql to create missing indexes');
		}

		// Overall health
		const overallHealth =
			issues.filter((i) => i.severity === 'high').length > 0
				? 'CRITICAL'
				: issues.filter((i) => i.severity === 'medium').length > 0
					? 'DEGRADED'
					: 'HEALTHY';

		if (recommendations.length === 0 && issues.length === 0) {
			recommendations.push('✅ Database health looks good');
		}

		return json({
			success: true,
			overall_health: overallHealth,
			integrity_ok: integrityOk,
			issues,
			recommendations,
			stats: {
				total_issues: issues.length,
				critical: issues.filter((i) => i.severity === 'high').length,
				warnings: issues.filter((i) => i.severity === 'medium').length,
				info: issues.filter((i) => i.severity === 'low').length
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
