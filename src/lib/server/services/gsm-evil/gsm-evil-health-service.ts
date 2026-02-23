import Database from 'better-sqlite3';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

export interface GsmEvilHealth {
	grgsm: {
		isRunning: boolean;
		pid: number | null;
		runtime: number;
		status: string;
	};
	gsmevil: {
		isRunning: boolean;
		pid: number | null;
		hasWebInterface: boolean;
		hasPort8080: boolean;
		status: string;
	};
	dataFlow: {
		isGsmtapActive: boolean;
		isPort4729Active: boolean;
		isDatabaseAccessible: boolean;
		hasRecentData: boolean;
		status: string;
	};
	overall: {
		status: string;
		isPipelineHealthy: boolean;
		issues: string[];
		recommendations: string[];
	};
}

/** Build a default GsmEvilHealth object with all fields in their initial unknown/empty state. */
function buildDefaultHealth(): GsmEvilHealth {
	return {
		grgsm: {
			isRunning: false,
			pid: null,
			runtime: 0,
			status: 'unknown'
		},
		gsmevil: {
			isRunning: false,
			pid: null,
			hasWebInterface: false,
			hasPort8080: false,
			status: 'unknown'
		},
		dataFlow: {
			isGsmtapActive: false,
			isPort4729Active: false,
			isDatabaseAccessible: false,
			hasRecentData: false,
			status: 'unknown'
		},
		overall: {
			status: 'unknown',
			isPipelineHealthy: false,
			issues: [],
			recommendations: []
		}
	};
}

/** Check the GRGSM livemon process and populate the grgsm section of health. */
async function checkGrgsmProcess(health: GsmEvilHealth): Promise<void> {
	try {
		const { stdout: grgsmCheck } = await execFileAsync('/usr/bin/pgrep', [
			'-af',
			'grgsm_livemon_headless'
		]);
		const grgsmLine = grgsmCheck
			.split('\n')
			.filter((line) => line.trim() && !line.includes('timeout'))
			.at(0);

		if (!grgsmLine) {
			health.grgsm.status = 'stopped';
			return;
		}

		const parts = grgsmLine.trim().split(/\s+/);
		const pid = parseInt(parts[0]);
		if (isNaN(pid)) return;

		await populateGrgsmRuntime(health, pid);
	} catch {
		health.grgsm.status = 'stopped';
	}
}

/** Validate a GRGSM PID and fetch its runtime, updating health accordingly. */
async function populateGrgsmRuntime(health: GsmEvilHealth, pid: number): Promise<void> {
	try {
		const validPid = validateNumericParam(pid, 'pid', 1, 4194304);
		const { stdout: pidTime } = await execFileAsync('/usr/bin/ps', [
			'-o',
			'etimes=',
			'-p',
			String(validPid)
		]);
		const runtime = parseInt(pidTime.trim()) || 0;

		if (runtime > 10) {
			health.grgsm.isRunning = true;
			health.grgsm.pid = validPid;
			health.grgsm.runtime = runtime;
			health.grgsm.status = 'running';
		} else {
			health.grgsm.status = 'scan-process';
		}
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] PID runtime check failed', { error: msg });
	}
}

/** Check whether port 8080 has a LISTEN socket via lsof. */
async function checkPort8080Listener(): Promise<boolean> {
	try {
		const { stdout: portCheck } = await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/lsof',
			'-i',
			':8080'
		]);
		return portCheck.split('\n').some((line) => line.includes('LISTEN'));
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] Port 8080 check failed', { error: msg });
		return false;
	}
}

/** Check whether the GSM Evil HTTP interface on port 8080 responds with 200. */
async function checkWebInterface(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:8080', {
			signal: AbortSignal.timeout(3000)
		});
		return response.status === 200;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] HTTP check failed', { error: msg });
		return false;
	}
}

/** Check the GSM Evil Python process, port 8080 listener, and web interface. */
async function checkGsmEvilProcess(health: GsmEvilHealth): Promise<void> {
	try {
		const { stdout: gsmevilCheck } = await execFileAsync('/usr/bin/pgrep', [
			'-af',
			'GsmEvil.*\\.py'
		]);
		const gsmevilLine = gsmevilCheck
			.split('\n')
			.filter((line) => line.trim())
			.at(0);

		if (!gsmevilLine) {
			health.gsmevil.status = 'stopped';
			return;
		}

		const parts = gsmevilLine.trim().split(/\s+/);
		const pid = parseInt(parts[0]);
		if (isNaN(pid)) return;

		health.gsmevil.isRunning = true;
		health.gsmevil.pid = pid;
		health.gsmevil.status = 'running';

		health.gsmevil.hasPort8080 = await checkPort8080Listener();
		if (health.gsmevil.hasPort8080) {
			health.gsmevil.hasWebInterface = await checkWebInterface();
		}
	} catch {
		health.gsmevil.status = 'stopped';
	}
}

/** Check whether GSMTAP data is flowing on UDP port 4729. */
async function checkGsmtapPort(health: GsmEvilHealth): Promise<void> {
	try {
		const { stdout: ssOut } = await execFileAsync('/usr/bin/ss', ['-u', '-n']);
		const portCount = ssOut.split('\n').filter((line) => line.includes(':4729')).length;
		health.dataFlow.isPort4729Active = portCount > 0;
		health.dataFlow.isGsmtapActive = portCount > 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] GSMTAP port check failed', { error: msg });
	}
}

/** Test database connectivity by opening and immediately closing the GSM database. */
async function checkDatabaseAccessibility(dbPath: string): Promise<boolean> {
	try {
		const db = new Database(dbPath, { readonly: true });
		db.close();
		return true;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] Database connectivity test failed', { error: msg });
		return false;
	}
}

/** Query the GSM database for IMSI records captured in the last 10 minutes. */
function checkRecentData(dbPath: string): boolean {
	const db = new Database(dbPath, { readonly: true });
	try {
		const row = db
			.prepare(
				"SELECT COUNT(*) as count FROM imsi_data WHERE datetime(date_time) > datetime('now', '-10 minutes')"
			)
			.get() as { count: number } | undefined;
		return (row?.count ?? 0) > 0;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[gsm-evil-health] Recent data check failed', { error: msg });
		return false;
	} finally {
		db.close();
	}
}

/** Check database accessibility and recent data presence, updating the dataFlow section of health. */
async function checkDatabaseHealth(health: GsmEvilHealth): Promise<void> {
	try {
		const { resolveGsmDatabasePath } = await import('$lib/server/gsm-database-path');
		const dbPath = await resolveGsmDatabasePath();

		if (!dbPath) return;

		health.dataFlow.isDatabaseAccessible = await checkDatabaseAccessibility(dbPath);
		if (health.dataFlow.isDatabaseAccessible) {
			health.dataFlow.hasRecentData = checkRecentData(dbPath);
		}
	} catch (dbError: unknown) {
		const msg = dbError instanceof Error ? dbError.message : String(dbError);
		logger.warn('[gsm-evil-health] Database health check failed', { error: msg });
		health.dataFlow.isDatabaseAccessible = false;
	}
}

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
	const issues: string[] = [];
	const recommendations: string[] = [];

	if (!health.grgsm.isRunning) {
		issues.push('GRGSM monitor not running');
		recommendations.push('Start GRGSM process to capture RF signals');
	}

	if (!health.gsmevil.isRunning) {
		issues.push('GSM Evil service not running');
		recommendations.push('Start GSM Evil web service');
	} else if (!health.gsmevil.hasWebInterface) {
		issues.push('GSM Evil web interface not responding');
		recommendations.push('Check GSM Evil service configuration');
	}

	if (!health.dataFlow.isGsmtapActive) {
		issues.push('GSMTAP data flow inactive');
		recommendations.push('Verify GRGSM is sending data to port 4729');
	}

	if (!health.dataFlow.isDatabaseAccessible) {
		issues.push('Database not accessible');
		recommendations.push('Check database path and permissions');
	}

	return { issues, recommendations };
}

/** Compute overall pipeline health status from component statuses and collected issues. */
function aggregateOverallHealth(health: GsmEvilHealth): void {
	const { issues, recommendations } = collectIssuesAndRecommendations(health);

	health.overall.isPipelineHealthy =
		health.grgsm.isRunning &&
		health.gsmevil.isRunning &&
		health.gsmevil.hasWebInterface &&
		health.dataFlow.isGsmtapActive &&
		health.dataFlow.isDatabaseAccessible;

	health.overall.issues = issues;
	health.overall.recommendations = recommendations;

	if (health.overall.isPipelineHealthy) {
		health.overall.status = health.dataFlow.hasRecentData ? 'healthy' : 'healthy-idle';
	} else if (health.grgsm.isRunning || health.gsmevil.isRunning) {
		health.overall.status = 'partial';
	} else {
		health.overall.status = 'stopped';
	}
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
