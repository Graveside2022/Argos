import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { checkGsmEvilHealth } from '$lib/server/services/gsm-evil/gsm-evil-health-service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/**
 * GET /api/gsm-evil/health
 * Returns comprehensive health status of GSM Evil pipeline
 */
export const GET: RequestHandler = async () => {
	try {
		const health = await checkGsmEvilHealth();

		return json({
			timestamp: new Date().toISOString(),
			health,
			summary: {
				status: health.overall.status,
				isPipelineHealthy: health.overall.isPipelineHealthy,
				componentsRunning: {
					grgsm: health.grgsm.isRunning,
					gsmevil: health.gsmevil.isRunning,
					hasWebInterface: health.gsmevil.hasWebInterface,
					dataFlow:
						health.dataFlow.status === 'active' || health.dataFlow.status === 'idle'
				},
				issueCount: health.overall.issues.length,
				uptime: {
					grgsm: health.grgsm.runtime,
					gsmevil: health.gsmevil.pid ? 'running' : 'stopped'
				}
			}
		});
	} catch (error: unknown) {
		logger.error('Health check endpoint error', { error: errMsg(error) });
		return json(
			{
				timestamp: new Date().toISOString(),
				health: null,
				error: 'Health check failed',
				message: errMsg(error)
			},
			{ status: 500 }
		);
	}
};
