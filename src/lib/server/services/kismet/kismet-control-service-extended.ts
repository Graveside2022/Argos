import { homedir, userInfo } from 'os';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { withRetry } from '$lib/server/retry';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import { detectWifiAdapter, type KismetStatusResult, pgrepKismet } from './kismet-status-checker';

export type { KismetStatusResult };

export interface KismetControlResult {
	success: boolean;
	message: string;
	details?: string;
	pid?: number;
	error?: string;
}

/** Clean up stale monitor interfaces */
async function cleanupMonitorInterface(iface: string): Promise<void> {
	try {
		await execFileAsync('/usr/sbin/iw', ['dev', `${iface}mon`, 'del']);
	} catch {
		/* no monitor interface to clean */
	}
}

/** Spawn Kismet process as non-root user */
async function spawnKismet(iface: string): Promise<void> {
	const kismetUser = userInfo().username;
	await execFileAsync(
		'/usr/bin/sudo',
		[
			'-u',
			kismetUser,
			'/usr/bin/kismet',
			'-c',
			`${iface}:type=linuxwifi`,
			'--no-ncurses',
			'--no-line-wrap',
			'--daemonize',
			'--silent'
		],
		{ timeout: 15000, cwd: homedir() }
	);
	logger.info('[kismet] Start command issued', { user: kismetUser });
}

/** Wait for Kismet PID to appear, retrying up to 3 times */
async function waitForKismetPid(): Promise<string> {
	await delay(5000);
	const findPid = withRetry(
		async () => {
			const pid = await pgrepKismet();
			if (!pid) throw new Error('Kismet PID not found');
			return pid;
		},
		{ attempts: 3, delayMs: 2000, backoff: 'linear' }
	);
	try {
		return await findPid();
	} catch {
		return '';
	}
}

/** Check which OS user owns a process */
async function getProcessUser(pid: number): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/ps', ['-p', String(pid), '-o', 'user=']);
		return stdout.trim();
	} catch {
		return '';
	}
}

/** Set Kismet auth credentials if KISMET_PASSWORD is configured */
async function setupKismetAuth(): Promise<void> {
	const kismetAuthUser = env.KISMET_USER;
	const kismetPass = env.KISMET_PASSWORD;
	if (!kismetPass) {
		logger.warn('[kismet] KISMET_PASSWORD not set, skipping initial credential setup');
		return;
	}
	try {
		const response = await fetch(`${env.KISMET_API_URL}/session/set_password`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: `username=${encodeURIComponent(kismetAuthUser)}&password=${encodeURIComponent(kismetPass)}`,
			signal: AbortSignal.timeout(3000)
		});
		const authCheck = await response.text();
		if (authCheck.includes('Login configured')) {
			logger.info('[kismet] Initial credentials set');
		}
	} catch {
		// Already configured or not yet ready
	}
}

/** Pre-flight: check if already running or no adapter */
async function preflightCheck(): Promise<KismetControlResult | null> {
	const existingPids = await pgrepKismet();
	if (existingPids) {
		logger.info('[kismet] Already running', { pid: existingPids });
		return {
			success: true,
			message: 'Kismet is already running',
			details: `Process ID: ${existingPids}`
		};
	}
	return null;
}

/** Launch Kismet and verify it started, returning the result */
async function launchAndVerify(alfaInterface: string): Promise<KismetControlResult> {
	await cleanupMonitorInterface(alfaInterface);
	await spawnKismet(alfaInterface);

	const verifyPid = await waitForKismetPid();
	if (!verifyPid) {
		return {
			success: false,
			message: 'Kismet failed to start',
			error: 'Process not found after startup. Check if the WiFi adapter is available.'
		};
	}

	const validPid = validateNumericParam(parseInt(verifyPid, 10), 'pid', 1, 4194304);
	const userCheck = await getProcessUser(validPid);
	logger.info('[kismet] Running', { user: userCheck, pid: validPid });
	await setupKismetAuth();

	return {
		success: true,
		message: 'Kismet started successfully',
		details: `Running as ${userCheck || userInfo().username} (PID: ${validPid}) on ${alfaInterface}`,
		pid: validPid
	};
}

/** Start Kismet WiFi discovery service */
export async function startKismetExtended(): Promise<KismetControlResult> {
	try {
		logger.info('[kismet] Starting Kismet');

		const alreadyRunning = await preflightCheck();
		if (alreadyRunning) return alreadyRunning;

		const alfaInterface = detectWifiAdapter();
		if (!alfaInterface) {
			logger.warn('[kismet] No external WiFi adapter found');
			return {
				success: false,
				message:
					'No external WiFi adapter detected. Connect an ALFA adapter and try again.',
				error: 'No wlan1+ interface found'
			};
		}

		logger.info('[kismet] Using interface', { interface: alfaInterface });
		return await launchAndVerify(alfaInterface);
	} catch (error: unknown) {
		logger.error('[kismet] Start error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to start Kismet',
			error: errMsg(error)
		};
	}
}

/** Stop the kismet systemd service (best-effort) */
async function stopSystemdService(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'kismet']);
	} catch {
		/* service may not exist */
	}
}

/** Force kill kismet processes (best-effort) */
async function forceKillKismet(): Promise<void> {
	logger.warn('[kismet] Processes remain after systemctl stop, force killing');
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-x', '-9', 'kismet']);
	} catch {
		/* no process to kill */
	}
	await delay(1000);
}

/** Stop Kismet WiFi discovery service */
export async function stopKismetExtended(): Promise<KismetControlResult> {
	try {
		logger.info('[kismet] Stopping Kismet');

		const pids = await pgrepKismet();
		if (!pids) {
			await stopSystemdService();
			return {
				success: true,
				message: 'Kismet stopped successfully',
				details: 'No processes were running'
			};
		}

		await stopSystemdService();
		await delay(3000);

		if (await pgrepKismet()) await forceKillKismet();

		const finalCheck = await pgrepKismet();
		if (finalCheck) {
			return {
				success: false,
				message: 'Kismet stop attempted but processes remain',
				error: `PIDs still running: ${finalCheck}`
			};
		}

		logger.info('[kismet] Stopped successfully');
		return {
			success: true,
			message: 'Kismet stopped successfully',
			details: 'Service stopped and processes terminated'
		};
	} catch (error: unknown) {
		return {
			success: false,
			message: 'Failed to stop Kismet',
			error: errMsg(error)
		};
	}
}

export { getKismetStatus } from './kismet-status-checker';
