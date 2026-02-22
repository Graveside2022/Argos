import { getGsmEvilDir } from '$lib/server/gsm-database-path';
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
import {
	buildStopErrorResult,
	checkRemainingGsmProcesses,
	forceKillGsmProcesses,
	gracefulStopGsmProcesses,
	releaseHackRfResource
} from './gsm-evil-stop-helpers';

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

		await gracefulStopGsmProcesses();

		const remaining = await checkRemainingGsmProcesses();
		if (remaining.trim()) {
			await forceKillGsmProcesses();
		}

		logger.info('[gsm-evil] Processes stopped');
		stopResult = { success: true, message: 'GSM Evil stopped successfully' };
	} catch (error: unknown) {
		logger.error('[gsm-evil] Stop error', { error: (error as Error).message });
		stopResult = buildStopErrorResult(error);
	} finally {
		await releaseHackRfResource();
	}
	return stopResult;
}
