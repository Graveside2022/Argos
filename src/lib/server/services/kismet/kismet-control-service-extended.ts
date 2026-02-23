import { execFile } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { promisify } from 'util';

import { validateInterfaceName, validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

export interface KismetControlResult {
	success: boolean;
	message: string;
	details?: string;
	pid?: number;
	error?: string;
}
export interface KismetStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
}
/** Run pgrep -x kismet, returning stdout or empty string if not found. */
async function pgrepKismet(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout.trim();
	} catch {
		return '';
	}
}

/** Interfaces to skip when scanning for external WiFi adapters */
const SKIP_IFACES = new Set(['lo', 'eth0', 'wlan0', '']);
/** Check if a network interface has wireless capabilities */
function isWirelessAdapter(iface: string): boolean {
	try {
		statSync(`/sys/class/net/${iface}/wireless`);
		return true;
	} catch {
		return false;
	}
}

/** Read network interface names from sysfs */
function listNetworkInterfaces(): string[] {
	try {
		return readdirSync('/sys/class/net/');
	} catch {
		return [];
	}
}

/** Check if an interface is a candidate external wireless adapter */
function isExternalWireless(iface: string): boolean {
	if (SKIP_IFACES.has(iface)) return false;
	return isWirelessAdapter(validateInterfaceName(iface));
}

/** Detect the first external wireless interface */
function detectWifiAdapter(): string | null {
	const match = listNetworkInterfaces().find(isExternalWireless);
	return match ? validateInterfaceName(match) : null;
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
	const kismetUser = process.env.USER || 'kali';
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
	await new Promise((resolve) => setTimeout(resolve, 5000));
	for (let attempt = 0; attempt < 3; attempt++) {
		const pid = await pgrepKismet();
		if (pid) return pid;
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	return '';
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
	const kismetAuthUser = process.env.KISMET_USER || 'admin';
	const kismetPass = process.env.KISMET_PASSWORD;
	if (!kismetPass) {
		logger.warn('[kismet] KISMET_PASSWORD not set, skipping initial credential setup');
		return;
	}
	try {
		const response = await fetch('http://localhost:2501/session/set_password', {
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
		details: `Running as ${userCheck || 'kali'} (PID: ${validPid}) on ${alfaInterface}`,
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
		logger.error('[kismet] Start error', { error: (error as Error).message });
		return {
			success: false,
			message: 'Failed to start Kismet',
			error: (error as Error).message
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
	await new Promise((resolve) => setTimeout(resolve, 1000));
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
		await new Promise((resolve) => setTimeout(resolve, 3000));

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
			error: (error as { message?: string }).message
		};
	}
}

/** Check if the Kismet HTTP API is responding */
async function isKismetApiResponding(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:2501/system/timestamp.json', {
			signal: AbortSignal.timeout(2000)
		});
		const apiOut = await response.text();
		return apiOut.includes('timestamp') || apiOut.includes('{');
	} catch {
		return false;
	}
}

/** Get Kismet service status */
export async function getKismetStatus(): Promise<KismetStatusResult> {
	try {
		const hasProcess = !!(await pgrepKismet());
		const apiResponding = await isKismetApiResponding();
		const isRunning = hasProcess || apiResponding;
		return { success: true, isRunning, status: isRunning ? 'active' : 'inactive' };
	} catch {
		return { success: true, isRunning: false, status: 'inactive' };
	}
}
