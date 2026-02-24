import Database from 'better-sqlite3';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { safe } from '$lib/server/result';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

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
export function buildDefaultHealth(): GsmEvilHealth {
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

/** Check the GRGSM livemon process and populate the grgsm section of health. */
export async function checkGrgsmProcess(health: GsmEvilHealth): Promise<void> {
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

/** Check whether port 8080 has a LISTEN socket via lsof. */
async function checkPort8080Listener(): Promise<boolean> {
	const [result, err] = await safe(() =>
		execFileAsync('/usr/bin/sudo', ['/usr/bin/lsof', '-i', ':8080'])
	);
	if (err) {
		logger.warn('[gsm-evil-health] Port 8080 check failed', { error: err.message });
		return false;
	}
	return result.stdout.split('\n').some((line) => line.includes('LISTEN'));
}

/** Check whether the GSM Evil HTTP interface on port 8080 responds with 200. */
async function checkWebInterface(): Promise<boolean> {
	try {
		const response = await fetch(env.GSM_EVIL_URL, {
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
export async function checkGsmEvilProcess(health: GsmEvilHealth): Promise<void> {
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
export async function checkGsmtapPort(health: GsmEvilHealth): Promise<void> {
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
export async function checkDatabaseHealth(health: GsmEvilHealth): Promise<void> {
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
