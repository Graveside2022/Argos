import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { DatabaseCleanupService } from '$lib/server/db/cleanup-service';
import { getRFDatabase } from '$lib/server/db/database';
import { DatabaseOptimizer } from '$lib/server/db/db-optimizer';

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

function getCleanupService(): DatabaseCleanupService {
	const db = getRFDatabase();
	const cleanupService = db.getCleanupService();
	if (!cleanupService) {
		throw new Error('Cleanup service not initialized');
	}
	return cleanupService;
}

function initializeOptimizer() {
	if (!optimizer) {
		const db = getRFDatabase();
		optimizer = new DatabaseOptimizer(db['db'], {
			cacheSize: -2000,
			isWalMode: true,
			synchronous: 'NORMAL',
			mmapSize: 30000000,
			memoryLimit: 50 * 1024 * 1024
		});
	}
}

/** Timestamped success response helper. */
function okJson(data: Record<string, unknown>) {
	return json({ success: true, ...data, timestamp: Date.now() });
}

type CleanupAction = (cleanupService: DatabaseCleanupService, url: URL) => Response;

function handleStatus(cleanupService: DatabaseCleanupService): Response {
	return okJson({
		stats: cleanupService.getStats(),
		growth: cleanupService.getGrowthTrends(24),
		health: optimizer?.getHealthReport()
	});
}

function handleExport(cleanupService: DatabaseCleanupService, url: URL): Response {
	const days = parseInt(url.searchParams.get('days') || '7');
	const endTime = Date.now();
	const startTime = endTime - days * 24 * 60 * 60 * 1000;
	return okJson({
		data: cleanupService.exportAggregatedData(startTime, endTime),
		period: { startTime, endTime, days }
	});
}

const GET_ACTIONS: Record<string, CleanupAction> = {
	status: handleStatus,
	manual: (svc) => okJson({ message: 'Manual cleanup completed', stats: svc.runCleanup() }),
	vacuum: (svc) => okJson({ message: 'VACUUM completed', result: svc.vacuum() }),
	analyze: (svc) => {
		svc.analyze();
		optimizer?.analyze();
		return okJson({ message: 'Database statistics updated' });
	},
	aggregate: (svc) => {
		svc.runAggregation();
		return okJson({ message: 'Aggregation completed' });
	},
	optimize: () =>
		okJson({
			indexAnalysis: optimizer?.getIndexAnalysis(),
			slowQueries: optimizer?.getSlowQueries(),
			pragmas: optimizer?.getPragmaSettings()
		}),
	export: handleExport
};

export const GET = createHandler(({ url }) => {
	initializeOptimizer();
	const cleanupService = getCleanupService();
	const action = url.searchParams.get('action') || 'status';
	const handler = GET_ACTIONS[action];
	if (!handler) return json({ success: false, error: 'Invalid action' }, { status: 400 });
	return handler(cleanupService, url);
});

/** Validate and parse POST body. Returns parsed body or error response. */
function parsePostBody(rawBody: unknown) {
	const result = CleanupPostSchema.safeParse(rawBody);
	if (!result.success) {
		return {
			error: json(
				{ success: false, error: 'Invalid request body', details: result.error.format() },
				{ status: 400 }
			)
		};
	}
	return { body: result.data };
}

type PostAction = z.infer<typeof CleanupPostSchema>;

/** Dispatch POST action to the correct handler. */
function executePostAction(body: PostAction, cleanupService: DatabaseCleanupService) {
	if (body.action === 'configure')
		return okJson({
			success: false,
			message: 'Configuration must be updated in database initialization'
		});
	if (body.action === 'optimize-workload') {
		optimizer?.optimizeForWorkload(body.workload);
		return okJson({ message: `Optimized for ${body.workload} workload` });
	}
	cleanupService.cleanupAggregatedData(body.daysToKeep);
	return okJson({ message: `Cleaned up aggregated data older than ${body.daysToKeep} days` });
}

export const POST = createHandler(async ({ request }) => {
	initializeOptimizer();
	const cleanupService = getCleanupService();
	const parsed = parsePostBody(await request.json());
	if (parsed.error) return parsed.error;
	return executePostAction(parsed.body as PostAction, cleanupService);
});
