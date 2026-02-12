import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { checkGsmEvilHealth } from '$lib/server/services/gsm-evil/gsm-evil-health-service';

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
				pipelineHealthy: health.overall.pipelineHealthy,
				componentsRunning: {
					grgsm: health.grgsm.running,
					gsmevil: health.gsmevil.running,
					webInterface: health.gsmevil.webInterface,
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
		console.error('Health check endpoint error:', error);
		return json(
			{
				timestamp: new Date().toISOString(),
				health: null,
				error: 'Health check failed',
				message: (error as Error).message
			},
			{ status: 500 }
		);
	}
};
