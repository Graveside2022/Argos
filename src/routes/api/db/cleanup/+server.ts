import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { DatabaseCleanupService } from '$lib/server/db/cleanup-service';
import { getRFDatabase } from '$lib/server/db/database';
import { DatabaseOptimizer } from '$lib/server/db/db-optimizer';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const CleanupPostSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('configure'),
		config: z.record(z.unknown()).optional()
	}),
	z.object({
		action: z.literal('optimize-workload'),
		workload: z.enum(['read_heavy', 'write_heavy', 'mixed'])
	}),
	z.object({
		action: z.literal('cleanup-aggregated'),
		daysToKeep: z.number().int().min(1).max(365).default(30)
	})
]);

let optimizer: DatabaseOptimizer | null = null;

// Get cleanup service from database instance
function getCleanupService(): DatabaseCleanupService {
	const db = getRFDatabase();
	let cleanupService = db.getCleanupService();

	if (!cleanupService) {
		throw new Error('Cleanup service not initialized');
	}

	return cleanupService;
}

// Initialize optimizer
function initializeOptimizer() {
	if (!optimizer) {
		const db = getRFDatabase();
		optimizer = new DatabaseOptimizer(db['db'], {
			cacheSize: -2000, // 2MB cache for Pi
			walMode: true,
			synchronous: 'NORMAL',
			mmapSize: 30000000, // 30MB memory map
			memoryLimit: 50 * 1024 * 1024 // 50MB memory limit
		});
	}
}

export const GET: RequestHandler = ({ url }) => {
	try {
		initializeOptimizer();
		const cleanupService = getCleanupService();

		const action = url.searchParams.get('action') || 'status';

		switch (action) {
			case 'status': {
				// Get cleanup statistics
				const stats = cleanupService.getStats();
				const growth = cleanupService.getGrowthTrends(24);
				const health = optimizer?.getHealthReport();

				return json({
					success: true,
					stats,
					growth,
					health,
					timestamp: Date.now()
				});
			}

			case 'manual': {
				// Run manual cleanup
				const cleanupStats = cleanupService.runCleanup();

				return json({
					success: true,
					message: 'Manual cleanup completed',
					stats: cleanupStats,
					timestamp: Date.now()
				});
			}

			case 'vacuum': {
				// Run VACUUM
				const vacuumResult = cleanupService.vacuum();

				return json({
					success: true,
					message: 'VACUUM completed',
					result: vacuumResult,
					timestamp: Date.now()
				});
			}

			case 'analyze': {
				// Update statistics
				cleanupService.analyze();
				optimizer?.analyze();

				return json({
					success: true,
					message: 'Database statistics updated',
					timestamp: Date.now()
				});
			}

			case 'optimize': {
				// Get optimization suggestions
				const indexAnalysis = optimizer?.getIndexAnalysis();
				const slowQueries = optimizer?.getSlowQueries();
				const pragmas = optimizer?.getPragmaSettings();

				return json({
					success: true,
					indexAnalysis,
					slowQueries,
					pragmas,
					timestamp: Date.now()
				});
			}

			case 'aggregate': {
				// Run aggregation manually
				cleanupService.runAggregation();

				return json({
					success: true,
					message: 'Aggregation completed',
					timestamp: Date.now()
				});
			}

			case 'export': {
				// Export aggregated data
				const days = parseInt(url.searchParams.get('days') || '7');
				const endTime = Date.now();
				const startTime = endTime - days * 24 * 60 * 60 * 1000;

				const exportData = cleanupService.exportAggregatedData(startTime, endTime);

				return json({
					success: true,
					data: exportData,
					period: { startTime, endTime, days },
					timestamp: Date.now()
				});
			}

			default:
				return json(
					{
						success: false,
						error: 'Invalid action'
					},
					{ status: 400 }
				);
		}
	} catch (error: unknown) {
		logger.error('Database cleanup error', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Database cleanup failed'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		initializeOptimizer();
		const cleanupService = getCleanupService();

		const rawBody = await request.json();
		const result = CleanupPostSchema.safeParse(rawBody);
		if (!result.success) {
			return json(
				{
					success: false,
					error: 'Invalid request body',
					details: result.error.format()
				},
				{ status: 400 }
			);
		}
		const body = result.data;

		switch (body.action) {
			case 'configure':
				return json({
					success: false,
					message: 'Configuration must be updated in database initialization',
					timestamp: Date.now()
				});

			case 'optimize-workload': {
				optimizer?.optimizeForWorkload(body.workload);
				return json({
					success: true,
					message: `Optimized for ${body.workload} workload`,
					timestamp: Date.now()
				});
			}

			case 'cleanup-aggregated': {
				cleanupService.cleanupAggregatedData(body.daysToKeep);
				return json({
					success: true,
					message: `Cleaned up aggregated data older than ${body.daysToKeep} days`,
					timestamp: Date.now()
				});
			}
		}
	} catch (error: unknown) {
		logger.error('Database cleanup error', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Database cleanup failed'
			},
			{ status: 500 }
		);
	}
};

// Note: Cleanup service lifecycle is managed by the database instance
