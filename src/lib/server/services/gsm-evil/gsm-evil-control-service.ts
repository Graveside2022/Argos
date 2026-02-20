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

/**
 * Start GSM Evil monitoring with grgsm_livemon_headless and GsmEvil2
 * Acquires HackRF resource, validates frequency, starts daemons, and verifies processes
 *
 * @param frequency Optional frequency in MHz (800-1000, default 947.2)
 * @returns Result with success status and any errors
 */
export async function startGsmEvil(frequency?: string): Promise<GsmEvilStartResult> {
	try {
		// Pre-flight: check that required binaries and directories exist
		const gsmDir = getGsmEvilDir();
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

		// Acquire HackRF via Resource Manager
		let acquireResult = await resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
		if (!acquireResult.success) {
			// Check if the owning process is actually running — if not, force-release stale lock
			const owner = acquireResult.owner || 'unknown';
			logger.warn('[gsm-evil] HackRF held by owner — checking if still active', { owner });
			try {
				let gsmProc = '';
				try {
					const { stdout } = await execFileAsync('/usr/bin/pgrep', [
						'-f',
						'grgsm_livemon|GsmEvil'
					]);
					gsmProc = stdout;
				} catch {
					/* no match */
				}
				if (!gsmProc.trim()) {
					logger.warn('[gsm-evil] No active GSM process found — releasing stale lock', {
						owner
					});
					await resourceManager.forceRelease(HardwareDevice.HACKRF);
					acquireResult = await resourceManager.acquire(
						'gsm-evil',
						HardwareDevice.HACKRF
					);
				} else {
					// Active processes — kill them first
					logger.warn(
						'[gsm-evil] Found running GSM processes — killing them to free HackRF'
					);
					try {
						await execFileAsync('/usr/bin/sudo', [
							'/usr/bin/pkill',
							'-f',
							'grgsm_livemon_headless'
						]);
					} catch {
						/* no match is fine */
					}
					try {
						await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
					} catch {
						/* no match is fine */
					}
					await new Promise((resolve) => setTimeout(resolve, 1000));
					await resourceManager.forceRelease(HardwareDevice.HACKRF);
					acquireResult = await resourceManager.acquire(
						'gsm-evil',
						HardwareDevice.HACKRF
					);
				}
			} catch (_error: unknown) {
				logger.warn('[gsm-evil] Process check failed — forcing resource release');
				await resourceManager.forceRelease(HardwareDevice.HACKRF);
				acquireResult = await resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
			}

			if (!acquireResult.success) {
				return {
					success: false,
					message: `HackRF is currently in use by ${acquireResult.owner}. Please stop it first before starting GSM Evil.`,
					conflictingService: acquireResult.owner
				};
			}
		}

		// Validate frequency — prevents injection via template literal
		const validatedFreq = validateNumericParam(frequency || '947.2', 'frequency', 800, 1000);
		const freq = String(validatedFreq);
		const gain = '40';
		logger.info('[gsm-evil] Starting GSM Evil', { freq });

		// 1. Kill existing processes (ignore errors - may not be running)
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
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// 2. Start grgsm_livemon_headless with proper daemonization (like Kismet)
		// Use setsid to detach from parent process so dev server restarts don't kill it
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
			{
				detached: true,
				stdio: 'ignore'
			}
		);
		grgsmChild.unref();
		const grgsmPid = grgsmChild.pid;
		logger.info('[gsm-evil] grgsm started (daemonized)', { pid: grgsmPid });

		// 3. Ensure GsmEvil_auto.py exists with sniffers enabled
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

		// 4. Start GsmEvil2 (needs root for pyshark/tshark capture permissions)
		// Daemonize it so dev server restarts don't kill it
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
			{
				detached: true,
				cwd: gsmDir,
				stdio: ['ignore', logFd, logFd]
			}
		);
		evilChild.unref();
		closeSync(logFd);
		const evilPid = evilChild.pid;
		logger.info('[gsm-evil] GsmEvil2 started (daemonized)', { pid: evilPid });

		// 5. Wait for processes to initialize
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// 6. Verify both are running
		let grgsmCheck = '';
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', [
				'-f',
				'grgsm_livemon_headless'
			]);
			grgsmCheck = stdout;
		} catch {
			/* process not found */
		}
		let evilCheck = '';
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', [
				'-f',
				'GsmEvil(_auto)?\\.py'
			]);
			evilCheck = stdout;
		} catch {
			/* process not found */
		}

		if (!grgsmCheck.trim()) {
			throw new Error('grgsm_livemon_headless failed to start');
		}
		if (!evilCheck.trim()) {
			let logOut = '';
			try {
				const logContent = await readFileAsync('/tmp/gsmevil2.log', 'utf-8');
				logOut = logContent.split('\n').slice(-5).join('\n');
			} catch {
				/* log not readable */
			}
			throw new Error(`GsmEvil2 failed to start. Log: ${logOut}`);
		}
		logger.info('[gsm-evil] Both processes verified running');

		return {
			success: true,
			message: 'GSM Evil started successfully'
		};
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
