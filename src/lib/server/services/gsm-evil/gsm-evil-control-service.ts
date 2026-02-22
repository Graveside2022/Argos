import { execFile } from 'child_process';
import { promisify } from 'util';

import { getGsmEvilDir } from '$lib/server/gsm-database-path';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

import {
	acquireHackRfResource,
	checkPrerequisites,
	ensureGsmEvilAutoScript,
	killExistingGsmProcesses,
	spawnGrgsmLivemon,
	spawnGsmEvil2,
	verifyProcessesRunning
} from './gsm-evil-control-helpers';

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
		stopResult = { success: true, message: 'GSM Evil stopped successfully' };
	} catch (error: unknown) {
		logger.error('[gsm-evil] Stop error', { error: (error as Error).message });

		if (
			(error as { signal?: string }).signal === 'SIGTERM' ||
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
				error: (error as Error).message,
				suggestion: 'Check system logs or try nuclear stop option'
			};
		}
	} finally {
		await resourceManager.release('gsm-evil', HardwareDevice.HACKRF).catch((error: unknown) => {
			logger.warn('[gsm-evil] Graceful resource release failed, forcing', {
				error: String(error)
			});
			return resourceManager.forceRelease(HardwareDevice.HACKRF);
		});
	}
	return stopResult;
}
