import { createHandler } from '$lib/server/api/create-handler';
import { checkGsmEvilHealth } from '$lib/server/services/gsm-evil/gsm-evil-health-service';

/**
 * GET /api/gsm-evil/health
 * Returns comprehensive health status of GSM Evil pipeline
 */
export const GET = createHandler(async () => {
	const health = await checkGsmEvilHealth();

	return {
		timestamp: new Date().toISOString(),
		health,
		summary: {
			status: health.overall.status,
			isPipelineHealthy: health.overall.isPipelineHealthy,
			componentsRunning: {
				grgsm: health.grgsm.isRunning,
				gsmevil: health.gsmevil.isRunning,
				hasWebInterface: health.gsmevil.hasWebInterface,
				dataFlow: health.dataFlow.status === 'active' || health.dataFlow.status === 'idle'
			},
			issueCount: health.overall.issues.length,
			uptime: {
				grgsm: health.grgsm.runtime,
				gsmevil: health.gsmevil.pid ? 'running' : 'stopped'
			}
		}
	};
});
