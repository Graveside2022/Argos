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

/**
 * Start Kismet WiFi discovery service
 * Detects ALFA adapter, starts Kismet as current user, sets up auth credentials
 *
 * @returns Result with success status, process details, and any errors
 */
export async function startKismetExtended(): Promise<KismetControlResult> {
	try {
		logger.info('[kismet] Starting Kismet');

		// Check if Kismet is already running
		const existingPids = await pgrepKismet();
		if (existingPids) {
			logger.info('[kismet] Already running', { pid: existingPids });
			return {
				success: true,
				message: 'Kismet is already running',
				details: `Process ID: ${existingPids}`
			};
		}

		// Detect ALFA WiFi adapter interface (skip wlan0 = built-in Pi WiFi)
		let ifaces: string[] = [];
		try {
			ifaces = readdirSync('/sys/class/net/');
		} catch {
			/* no sysfs */
		}

		let alfaInterface = '';
		for (const iface of ifaces) {
			if (iface === 'lo' || iface === 'eth0' || iface === 'wlan0' || !iface) continue;
			const validIface = validateInterfaceName(iface);
			let isWireless = false;
			try {
				statSync(`/sys/class/net/${validIface}/wireless`);
				isWireless = true;
			} catch {
				/* not wireless */
			}
			if (isWireless) {
				alfaInterface = validIface;
				break;
			}
		}

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

		// Clean up stale monitor interfaces
		try {
			await execFileAsync('/usr/sbin/iw', ['dev', `${alfaInterface}mon`, 'del']);
		} catch {
			/* no monitor interface to clean */
		}

		// Start Kismet as current user (NOT root) -- capture helpers are suid
		// Uses --daemonize so Kismet forks into background
		// cwd set to home dir so Kismet can write its log database
		const kismetUser = process.env.USER || 'kali';
		await execFileAsync(
			'/usr/bin/sudo',
			[
				'-u',
				kismetUser,
				'/usr/bin/kismet',
				'-c',
				`${alfaInterface}:type=linuxwifi`,
				'--no-ncurses',
				'--no-line-wrap',
				'--daemonize',
				'--silent'
			],
			{ timeout: 15000, cwd: homedir() }
		);
		logger.info('[kismet] Start command issued', { user: kismetUser });

		// Wait for Kismet to initialize (needs time to bind port and set up capture)
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Verify running -- retry a few times
		let verifyPid = '';
		for (let attempt = 0; attempt < 3; attempt++) {
			verifyPid = await pgrepKismet();
			if (verifyPid) break;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		if (!verifyPid) {
			return {
				success: false,
				message: 'Kismet failed to start',
				error: 'Process not found after startup. Check if the WiFi adapter is available.'
			};
		}

		const validPid = validateNumericParam(parseInt(verifyPid, 10), 'pid', 1, 4194304);

		// Verify running as non-root
		let userCheck = '';
		try {
			const { stdout } = await execFileAsync('/usr/bin/ps', [
				'-p',
				String(validPid),
				'-o',
				'user='
			]);
			userCheck = stdout.trim();
		} catch {
			/* process gone */
		}
		logger.info('[kismet] Running', { user: userCheck, pid: validPid });

		// Set up auth credentials if this is a first-time start
		try {
			const kismetAuthUser = process.env.KISMET_USER || 'admin';
			const kismetPass = process.env.KISMET_PASSWORD;
			if (!kismetPass) {
				logger.warn('[kismet] KISMET_PASSWORD not set, skipping initial credential setup');
			} else {
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
			}
		} catch {
			// Already configured or not yet ready
		}

		return {
			success: true,
			message: 'Kismet started successfully',
			details: `Running as ${userCheck || 'kali'} (PID: ${validPid}) on ${alfaInterface}`,
			pid: validPid
		};
	} catch (error: unknown) {
		logger.error('[kismet] Start error', { error: (error as Error).message });
		return {
			success: false,
			message: 'Failed to start Kismet',
			error: (error as Error).message
		};
	}
}

/**
 * Stop Kismet WiFi discovery service
 * Stops via systemctl, force kills remaining processes, verifies stopped
 *
 * @returns Result with success status and details
 */
export async function stopKismetExtended(): Promise<KismetControlResult> {
	try {
		logger.info('[kismet] Stopping Kismet');

		// Check if Kismet is running at all
		const pids = await pgrepKismet();
		if (!pids) {
			// Also ensure systemd service is stopped
			try {
				await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'kismet']);
			} catch {
				/* service may not exist */
			}
			return {
				success: true,
				message: 'Kismet stopped successfully',
				details: 'No processes were running'
			};
		}

		// Stop via systemctl first (prevents Restart=always from respawning)
		try {
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'kismet']);
		} catch {
			/* service may not exist */
		}
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Force kill any remaining processes not managed by systemd
		const remaining = await pgrepKismet();
		if (remaining) {
			logger.warn('[kismet] Processes remain after systemctl stop, force killing');
			try {
				await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-x', '-9', 'kismet']);
			} catch {
				/* no process to kill */
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		// Verify stopped
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

/**
 * Get Kismet service status
 * Checks process and API availability
 *
 * @returns Status with running state
 */
export async function getKismetStatus(): Promise<KismetStatusResult> {
	try {
		const hasProcess = !!(await pgrepKismet());

		// Double-check via API
		let apiResponding = false;
		try {
			const response = await fetch('http://localhost:2501/system/timestamp.json', {
				signal: AbortSignal.timeout(2000)
			});
			const apiOut = await response.text();
			apiResponding = apiOut.includes('timestamp') || apiOut.includes('{');
		} catch {
			// Not responding
		}

		const isRunning = hasProcess || apiResponding;
		return {
			success: true,
			isRunning: isRunning,
			status: isRunning ? 'active' : 'inactive'
		};
	} catch {
		return {
			success: true,
			isRunning: false,
			status: 'inactive'
		};
	}
}
