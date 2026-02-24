import { stat } from 'fs/promises';

import { createHandler } from '$lib/server/api/create-handler';
import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { getGsmEvilDir } from '$lib/server/gsm-database-path';
import { gsmMonitor } from '$lib/server/services/gsm-evil/gsm-monitor-service';
import { logger } from '$lib/utils/logger';

async function checkGrgsmRunning(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless']);
		return stdout.trim().length > 0;
	} catch (_error: unknown) {
		// pgrep exits 1 when no process matches — expected when not running
		return false;
	}
}

function extractPacketsFromError(error: unknown): number {
	if (
		error &&
		typeof error === 'object' &&
		'stdout' in error &&
		typeof error.stdout === 'string'
	) {
		return error.stdout.split('\n').filter((l: string) => l.trim()).length;
	}
	logger.warn('[gsm-evil-activity] tcpdump check failed', {
		error: String(error)
	});
	return 0;
}

async function countGsmtapPackets(): Promise<number> {
	try {
		const { stdout: tcpdumpOutput } = await execFileAsync(
			'/usr/bin/sudo',
			['timeout', '1', 'tcpdump', '-i', 'lo', '-nn', 'port', '4729'],
			{ timeout: 3000 }
		);
		return tcpdumpOutput.split('\n').filter((l) => l.trim()).length;
	} catch (error: unknown) {
		// timeout exits 124 when it kills tcpdump, tcpdump may also exit non-zero
		// Try to parse any partial stdout from the error
		return extractPacketsFromError(error);
	}
}

async function checkRecentImsi(): Promise<boolean> {
	try {
		const imsiDbPath = `${getGsmEvilDir()}/database/imsi.db`;
		const stats = await stat(imsiDbPath);
		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
		return stats.mtimeMs > fiveMinutesAgo;
	} catch (_error: unknown) {
		// File doesn't exist or is inaccessible
		return false;
	}
}

async function getCurrentFrequency(): Promise<string> {
	try {
		const { stdout: psOutput } = await execFileAsync('/usr/bin/pgrep', [
			'-af',
			'grgsm_livemon_headless'
		]);
		const freqMatch = psOutput.match(/-f\s+(\d+\.?\d*)M/);
		return freqMatch ? freqMatch[1] : '947.2';
	} catch (_error: unknown) {
		// pgrep exits 1 when no match — use default frequency
		return '947.2';
	}
}

function getChannelInfo(): string {
	try {
		return gsmMonitor.getActivityStats();
	} catch (_error: unknown) {
		/* channel type check failed - non-critical */
		return '';
	}
}

function buildSuggestion(packets: number, recentIMSI: boolean): string | null {
	if (packets === 0) return 'Try different frequencies or check antenna';
	if (!recentIMSI) return 'Receiving control data only - no IMSI broadcasts detected';
	return null;
}

export const GET = createHandler(async () => {
	try {
		const grgsmRunning = await checkGrgsmRunning();
		if (!grgsmRunning) {
			return {
				success: false,
				hasActivity: false,
				message: 'GSM monitor not running'
			};
		}

		const packets = await countGsmtapPackets();
		const recentIMSI = await checkRecentImsi();
		const currentFreq = await getCurrentFrequency();
		const channelInfo = getChannelInfo();

		return {
			success: true,
			hasActivity: packets > 0,
			packetCount: packets,
			recentIMSI: recentIMSI,
			currentFrequency: currentFreq,
			message:
				packets > 0 ? `Receiving data (${packets} packets/sec)` : 'No activity detected',
			channelInfo: channelInfo || 'No channel info',
			suggestion: buildSuggestion(packets, recentIMSI)
		};
	} catch (error: unknown) {
		logger.error('Activity check error', { error: String(error) });
		return {
			success: false,
			hasActivity: false,
			message: 'Failed to check activity',
			error: errMsg(error)
		};
	}
});
