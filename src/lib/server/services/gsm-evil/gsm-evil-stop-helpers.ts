/**
 * GSM Evil Stop Helpers
 * Process cleanup, force-kill, error result building, and resource release for stopGsmEvil()
 */

import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { logger } from '$lib/utils/logger';

import type { GsmEvilStopResult } from './gsm-evil-control-service';

/** Gracefully kill GSM Evil processes and free port 8080 */
export async function gracefulStopGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'grgsm_livemon_headless']);
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
}

/** Check if any GSM Evil processes remain after graceful stop */
export async function checkRemainingGsmProcesses(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', [
			'-f',
			'grgsm_livemon_headless|GsmEvil'
		]);
		return stdout;
	} catch {
		return '';
	}
}

/** Force-kill remaining GSM Evil processes with SIGKILL */
export async function forceKillGsmProcesses(): Promise<void> {
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

/** Build a GsmEvilStopResult from a stop error, distinguishing timeouts */
export function buildStopErrorResult(error: unknown): GsmEvilStopResult {
	const isTimeout =
		(error as { signal?: string }).signal === 'SIGTERM' ||
		(error as Error).message.includes('timeout');

	if (isTimeout) {
		return {
			success: false,
			message: 'GSM Evil stop operation timed out - some processes may still be running',
			error: 'Stop script exceeded 30 second timeout',
			suggestion: 'Consider using nuclear stop option or manual intervention'
		};
	}

	return {
		success: false,
		message: 'Failed to stop GSM Evil',
		error: (error as Error).message,
		suggestion: 'Check system logs or try nuclear stop option'
	};
}

/** Release the HackRF resource, force-releasing if graceful release fails */
export async function releaseHackRfResource(): Promise<void> {
	await resourceManager.release('gsm-evil', HardwareDevice.HACKRF).catch((error: unknown) => {
		logger.warn('[gsm-evil] Graceful resource release failed, forcing', {
			error: String(error)
		});
		return resourceManager.forceRelease(HardwareDevice.HACKRF);
	});
}
