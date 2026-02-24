import { logger } from '$lib/utils/logger';

import {
	buildDefaultHealth,
	checkDatabaseHealth,
	checkGrgsmProcess,
	checkGsmEvilProcess,
	checkGsmtapPort,
	type GsmEvilHealth
} from './gsm-evil-health-checks';

export type { GsmEvilHealth } from './gsm-evil-health-checks';

/** Health check rule: condition → issue + recommendation */
interface HealthRule {
	check: (h: GsmEvilHealth) => boolean;
	issue: string;
	recommendation: string;
}

/** Rules evaluated to collect issues and recommendations */
const HEALTH_RULES: HealthRule[] = [
	{
		check: (h) => !h.grgsm.isRunning,
		issue: 'GRGSM monitor not running',
		recommendation: 'Start GRGSM process to capture RF signals'
	},
	{
		check: (h) => !h.gsmevil.isRunning,
		issue: 'GSM Evil service not running',
		recommendation: 'Start GSM Evil web service'
	},
	{
		check: (h) => h.gsmevil.isRunning && !h.gsmevil.hasWebInterface,
		issue: 'GSM Evil web interface not responding',
		recommendation: 'Check GSM Evil service configuration'
	},
	{
		check: (h) => !h.dataFlow.isGsmtapActive,
		issue: 'GSMTAP data flow inactive',
		recommendation: 'Verify GRGSM is sending data to port 4729'
	},
	{
		check: (h) => !h.dataFlow.isDatabaseAccessible,
		issue: 'Database not accessible',
		recommendation: 'Check database path and permissions'
	}
];

/** Determine the data flow status string from the individual data flow flags. */
function determineDataFlowStatus(health: GsmEvilHealth): void {
	if (health.dataFlow.isGsmtapActive && health.dataFlow.isDatabaseAccessible) {
		health.dataFlow.status = health.dataFlow.hasRecentData ? 'active' : 'idle';
	} else {
		health.dataFlow.status = 'broken';
	}
}

/** Collect issues and recommendations based on individual component statuses. */
function collectIssuesAndRecommendations(health: GsmEvilHealth): {
	issues: string[];
	recommendations: string[];
} {
	const matched = HEALTH_RULES.filter((rule) => rule.check(health));
	return {
		issues: matched.map((r) => r.issue),
		recommendations: matched.map((r) => r.recommendation)
	};
}

/** Check if all pipeline components are running and accessible */
function isPipelineHealthy(health: GsmEvilHealth): boolean {
	return (
		health.grgsm.isRunning &&
		health.gsmevil.isRunning &&
		health.gsmevil.hasWebInterface &&
		health.dataFlow.isGsmtapActive &&
		health.dataFlow.isDatabaseAccessible
	);
}

/** Determine the overall status string from pipeline state */
function resolveOverallStatus(health: GsmEvilHealth, pipelineOk: boolean): string {
	if (pipelineOk) return health.dataFlow.hasRecentData ? 'healthy' : 'healthy-idle';
	if (health.grgsm.isRunning || health.gsmevil.isRunning) return 'partial';
	return 'stopped';
}

/** Compute overall pipeline health status from component statuses and collected issues. */
function aggregateOverallHealth(health: GsmEvilHealth): void {
	const { issues, recommendations } = collectIssuesAndRecommendations(health);
	const pipelineOk = isPipelineHealthy(health);

	health.overall.isPipelineHealthy = pipelineOk;
	health.overall.issues = issues;
	health.overall.recommendations = recommendations;
	health.overall.status = resolveOverallStatus(health, pipelineOk);
}

/** Performs a comprehensive health check of the GSM Evil pipeline (GRGSM, web service, GSMTAP data flow, and database). */
export async function checkGsmEvilHealth(): Promise<GsmEvilHealth> {
	const health = buildDefaultHealth();

	try {
		await Promise.all([
			checkGrgsmProcess(health).catch((e) => {
				health.overall.issues.push(
					`GRGSM check failed: ${e instanceof Error ? e.message : String(e)}`
				);
			}),
			checkGsmEvilProcess(health).catch((e) => {
				health.overall.issues.push(
					`GSM Evil check failed: ${e instanceof Error ? e.message : String(e)}`
				);
			}),
			checkGsmtapPort(health).catch((e) => {
				health.overall.issues.push(
					`GSMTAP check failed: ${e instanceof Error ? e.message : String(e)}`
				);
			}),
			checkDatabaseHealth(health).catch((e) => {
				health.overall.issues.push(
					`Database check failed: ${e instanceof Error ? e.message : String(e)}`
				);
			})
		]);
		determineDataFlowStatus(health);
		aggregateOverallHealth(health);
	} catch (error) {
		logger.error('[gsm-evil-health] Health check error', {
			error: error instanceof Error ? error.message : String(error)
		});
		health.overall.status = 'error';
		health.overall.issues.push('Health check failed');
	}

	return health;
}
