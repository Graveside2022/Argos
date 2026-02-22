import { execFile, spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { access, copyFile, readFile as readFileAsync, writeFile } from 'fs/promises';
import { promisify } from 'util';

import { getGsmEvilDir } from '$lib/server/gsm-database-path';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

const execFileAsync = promisify(execFile);

export interface GsmEvilStartResult {
	success: boolean;
	message: string;
	error?: string;
	conflictingService?: string;
}

export interface GsmEvilStopResult {
	success: boolean;
	message: string;
	error?: string;
	suggestion?: string;
}

/** Check that grgsm_livemon_headless binary and GsmEvil.py script exist */
async function checkPrerequisites(gsmDir: string): Promise<GsmEvilStartResult | null> {
	try {
		await execFileAsync('/usr/bin/which', ['grgsm_livemon_headless']);
	} catch {
		return {
			success: false,
			message: 'grgsm_livemon_headless is not installed. Run: sudo apt install gr-gsm'
		};
	}
	try {
		await access(`${gsmDir}/GsmEvil.py`);
	} catch {
		return {
			success: false,
			message: `GsmEvil2 not found at ${gsmDir}. Run: git clone https://github.com/ninjhacks/gsmevil2.git ${gsmDir}`
		};
	}
	return null;
}

/** Kill any running grgsm_livemon_headless and GsmEvil processes */
async function killExistingGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'grgsm_livemon_headless']);
	} catch {
		/* no match is fine */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
	} catch {
		/* no match is fine */
	}
	await new Promise((resolve) => setTimeout(resolve, 1000));
}

/** Check if GSM processes are actively running via pgrep */
async function findActiveGsmProcesses(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon|GsmEvil']);
		return stdout;
	} catch {
		return '';
	}
}

/** Release a stale HackRF lock when no GSM processes are running */
async function releaseStaleHackRfLock(owner: string): Promise<void> {
	logger.warn('[gsm-evil] No active GSM process found — releasing stale lock', { owner });
	await resourceManager.forceRelease(HardwareDevice.HACKRF);
}

/** Kill active GSM processes and force-release HackRF to reclaim the resource */
async function reclaimHackRfFromActiveProcesses(): Promise<void> {
	logger.warn('[gsm-evil] Found running GSM processes — killing them to free HackRF');
	await killExistingGsmProcesses();
	await resourceManager.forceRelease(HardwareDevice.HACKRF);
}

/**
 * Recover a stale or conflicting HackRF lock by checking if the owning
 * process is still alive. If stale, force-releases. If active, kills
 * the processes first, then re-acquires.
 */
async function recoverStaleHackRfLock(
	owner: string
): Promise<{ success: boolean; owner?: string }> {
	logger.warn('[gsm-evil] HackRF held by owner — checking if still active', { owner });
	try {
		const gsmProc = await findActiveGsmProcesses();
		if (!gsmProc.trim()) {
			await releaseStaleHackRfLock(owner);
		} else {
			await reclaimHackRfFromActiveProcesses();
		}
	} catch (_error: unknown) {
		logger.warn('[gsm-evil] Process check failed — forcing resource release');
		await resourceManager.forceRelease(HardwareDevice.HACKRF);
	}
	return resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
}

/**
 * Acquire HackRF via the resource manager, recovering stale locks if needed.
 * Returns an early-exit error result or null on success.
 */
async function acquireHackRfResource(): Promise<GsmEvilStartResult | null> {
	let acquireResult = await resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
	if (!acquireResult.success) {
		const owner = acquireResult.owner || 'unknown';
		acquireResult = await recoverStaleHackRfLock(owner);
	}
	if (!acquireResult.success) {
		return {
			success: false,
			message: `HackRF is currently in use by ${acquireResult.owner}. Please stop it first before starting GSM Evil.`,
			conflictingService: acquireResult.owner
		};
	}
	return null;
}

/**
 * Spawn grgsm_livemon_headless as a daemonized process via setsid.
 * Detaches from parent so dev server restarts do not kill it.
 */
function spawnGrgsmLivemon(freq: string, gain: string): void {
	const grgsmChild = spawn(
		'/usr/bin/sudo',
		[
			'/usr/bin/setsid',
			'grgsm_livemon_headless',
			'-f',
			`${freq}M`,
			'-g',
			gain,
			'--collector',
			'localhost',
			'--collectorport',
			'4729'
		],
		{ detached: true, stdio: 'ignore' }
	);
	grgsmChild.unref();
	logger.info('[gsm-evil] grgsm started (daemonized)', { pid: grgsmChild.pid });
}

/**
 * Ensure GsmEvil_auto.py exists with IMSI and GSM sniffers enabled.
 * Copies from GsmEvil.py and patches sniffer flags if needed.
 */
async function ensureGsmEvilAutoScript(gsmDir: string): Promise<void> {
	try {
		await access(`${gsmDir}/GsmEvil_auto.py`);
	} catch {
		try {
			await copyFile(`${gsmDir}/GsmEvil.py`, `${gsmDir}/GsmEvil_auto.py`);
			let content = await readFileAsync(`${gsmDir}/GsmEvil_auto.py`, 'utf-8');
			content = content.replace('imsi_sniffer = "off"', 'imsi_sniffer = "on"');
			content = content.replace('gsm_sniffer = "off"', 'gsm_sniffer = "on"');
			await writeFile(`${gsmDir}/GsmEvil_auto.py`, content);
		} catch {
			logger.warn('[gsm-evil] GsmEvil_auto.py setup note');
		}
	}
}

/**
 * Spawn GsmEvil2 Python process as a daemonized service.
 * Runs with root for pyshark/tshark capture permissions.
 */
function spawnGsmEvil2(gsmDir: string): void {
	const logFd = openSync('/tmp/gsmevil2.log', 'a');
	const evilChild = spawn(
		'/usr/bin/sudo',
		[
			'/usr/bin/setsid',
			'/usr/bin/python3',
			'GsmEvil_auto.py',
			'--host',
			'0.0.0.0',
			'--port',
			'8080'
		],
		{ detached: true, cwd: gsmDir, stdio: ['ignore', logFd, logFd] }
	);
	evilChild.unref();
	closeSync(logFd);
	logger.info('[gsm-evil] GsmEvil2 started (daemonized)', { pid: evilChild.pid });
}

/** Check via pgrep that grgsm_livemon_headless is running */
async function checkGrgsmRunning(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless']);
		return Boolean(stdout.trim());
	} catch {
		return false;
	}
}

/** Check via pgrep that GsmEvil2 Python process is running */
async function checkGsmEvil2Running(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', 'GsmEvil(_auto)?\\.py']);
		return Boolean(stdout.trim());
	} catch {
		return false;
	}
}

/** Read the last 5 lines of the GsmEvil2 log for error diagnostics */
async function readGsmEvil2LogTail(): Promise<string> {
	try {
		const logContent = await readFileAsync('/tmp/gsmevil2.log', 'utf-8');
		return logContent.split('\n').slice(-5).join('\n');
	} catch {
		return '';
	}
}

/**
 * Verify both grgsm_livemon_headless and GsmEvil2 are running.
 * Throws with diagnostic information if either process failed to start.
 */
async function verifyProcessesRunning(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 3000));

	const isGrgsmRunning = await checkGrgsmRunning();
	if (!isGrgsmRunning) {
		throw new Error('grgsm_livemon_headless failed to start');
	}

	const isEvilRunning = await checkGsmEvil2Running();
	if (!isEvilRunning) {
		const logTail = await readGsmEvil2LogTail();
		throw new Error(`GsmEvil2 failed to start. Log: ${logTail}`);
	}
	logger.info('[gsm-evil] Both processes verified running');
}

/**
 * Start GSM Evil monitoring with grgsm_livemon_headless and GsmEvil2.
 * Acquires HackRF resource, validates frequency, starts daemons, and verifies processes.
 *
 * @param frequency Optional frequency in MHz (800-1000, default 947.2)
 * @returns Result with success status and any errors
 */
export async function startGsmEvil(frequency?: string): Promise<GsmEvilStartResult> {
	try {
		const gsmDir = getGsmEvilDir();

		const prereqError = await checkPrerequisites(gsmDir);
		if (prereqError) return prereqError;

		const acquireError = await acquireHackRfResource();
		if (acquireError) return acquireError;

		const validatedFreq = validateNumericParam(frequency || '947.2', 'frequency', 800, 1000);
		const freq = String(validatedFreq);
		const gain = '40';
		logger.info('[gsm-evil] Starting GSM Evil', { freq });

		await killExistingGsmProcesses();
		spawnGrgsmLivemon(freq, gain);
		await ensureGsmEvilAutoScript(gsmDir);
		spawnGsmEvil2(gsmDir);
		await verifyProcessesRunning();

		return { success: true, message: 'GSM Evil started successfully' };
	} catch (error: unknown) {
		logger.error('[gsm-evil] Start error', { error: (error as Error).message });
		return {
			success: false,
			message: 'Failed to start GSM Evil',
			// Safe: Catch block error from spawn/exec failures cast to Error for message extraction
			error: (error as Error).message
		};
	}
}

/**
 * Stop GSM Evil monitoring (grgsm and GsmEvil processes)
 * ALWAYS releases HackRF resource, even if cleanup is partial (prevents deadlocks)
 *
 * @returns Result with success status, errors, and suggestions
 */
export async function stopGsmEvil(): Promise<GsmEvilStopResult> {
	let stopResult: GsmEvilStopResult;
	try {
		logger.info('[gsm-evil] Stopping GSM Evil');

		// Kill processes directly (same pattern as working scan endpoint)
		try {
			await execFileAsync('/usr/bin/sudo', [
				'/usr/bin/pkill',
				'-f',
				'grgsm_livemon_headless'
			]);
		} catch (error: unknown) {
			logger.warn('[gsm-evil] Cleanup: pkill grgsm_livemon_headless failed', {
				error: String(error)
			});
		}
		try {
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
		} catch (error: unknown) {
			logger.warn('[gsm-evil] Cleanup: pkill GsmEvil failed', { error: String(error) });
		}
		try {
			await execFileAsync('/usr/bin/sudo', ['/usr/bin/fuser', '-k', '8080/tcp']);
		} catch (error: unknown) {
			logger.warn('[gsm-evil] Cleanup: fuser kill port 8080 failed', {
				error: String(error)
			});
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Verify processes are stopped
		let remaining = '';
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', [
				'-f',
				'grgsm_livemon_headless|GsmEvil'
			]);
			remaining = stdout;
		} catch {
			/* no remaining processes */
		}

		if (remaining.trim()) {
			// Force kill
			try {
				await execFileAsync('/usr/bin/sudo', [
					'/usr/bin/pkill',
					'-9',
					'-f',
					'grgsm_livemon_headless'
				]);
			} catch (error: unknown) {
				logger.warn('[gsm-evil] Cleanup: pkill -9 grgsm_livemon_headless failed', {
					error: String(error)
				});
			}
			try {
				await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-9', '-f', 'GsmEvil']);
			} catch (error: unknown) {
				logger.warn('[gsm-evil] Cleanup: pkill -9 GsmEvil failed', {
					error: String(error)
				});
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		logger.info('[gsm-evil] Processes stopped');
		stopResult = {
			success: true,
			message: 'GSM Evil stopped successfully'
		};
	} catch (error: unknown) {
		logger.error('[gsm-evil] Stop error', { error: (error as Error).message });

		if (
			// Safe: Error object cast to check for optional signal property (timeout detection)
			(error as { signal?: string }).signal === 'SIGTERM' ||
			// Safe: Error object cast to Error for message string access
			(error as Error).message.includes('timeout')
		) {
			stopResult = {
				success: false,
				message: 'GSM Evil stop operation timed out - some processes may still be running',
				error: 'Stop script exceeded 30 second timeout',
				suggestion: 'Consider using nuclear stop option or manual intervention'
			};
		} else {
			stopResult = {
				success: false,
				message: 'Failed to stop GSM Evil',
				// Safe: Catch block error cast to Error for message extraction in failure response
				error: (error as Error).message,
				suggestion: 'Check system logs or try nuclear stop option'
			};
		}
	} finally {
		// ALWAYS release HackRF — the stop was requested, so release the lock
		// even if cleanup was partial. This prevents deadlocks.
		await resourceManager.release('gsm-evil', HardwareDevice.HACKRF).catch((error: unknown) => {
			logger.warn('[gsm-evil] Graceful resource release failed, forcing', {
				error: String(error)
			});
			// If release fails (e.g., not owner), force-release as last resort
			return resourceManager.forceRelease(HardwareDevice.HACKRF);
		});
	}
	return stopResult;
}
