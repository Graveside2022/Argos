import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { stat } from 'fs/promises';
import { promisify } from 'util';

import { getGsmEvilDir } from '$lib/server/gsm-database-path';
import { gsmMonitor } from '$lib/server/services/gsm-evil/gsm-monitor-service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async () => {
	try {
		// Check if grgsm_livemon is running
		let grgsmRunning = false;
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', [
				'-f',
				'grgsm_livemon_headless'
			]);
			grgsmRunning = stdout.trim().length > 0;
		} catch (_error: unknown) {
			// pgrep exits 1 when no process matches — expected when not running
			grgsmRunning = false;
		}

		if (!grgsmRunning) {
			return json({
				success: false,
				hasActivity: false,
				message: 'GSM monitor not running'
			});
		}

		// Check for recent GSMTAP activity on port 4729
		let packets = 0;
		try {
			const { stdout: tcpdumpOutput } = await execFileAsync(
				'/usr/bin/sudo',
				['timeout', '1', 'tcpdump', '-i', 'lo', '-nn', 'port', '4729'],
				{ timeout: 3000 }
			);
			packets = tcpdumpOutput.split('\n').filter((l) => l.trim()).length;
		} catch (error: unknown) {
			// timeout exits 124 when it kills tcpdump, tcpdump may also exit non-zero
			// Try to parse any partial stdout from the error
			if (error && typeof error === 'object' && 'stdout' in error) {
				const stdout = (error as { stdout: string }).stdout;
				packets = stdout.split('\n').filter((l: string) => l.trim()).length;
			} else {
				logger.warn('[gsm-evil-activity] tcpdump check failed', {
					error: String(error)
				});
				packets = 0;
			}
		}

		// Check for recent IMSI database activity on the host
		let recentIMSI = false;
		try {
			const imsiDbPath = `${getGsmEvilDir()}/database/imsi.db`;
			const stats = await stat(imsiDbPath);
			const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
			recentIMSI = stats.mtimeMs > fiveMinutesAgo;
		} catch (_error: unknown) {
			// File doesn't exist or is inaccessible
			recentIMSI = false;
		}

		// Get current frequency from process
		let currentFreq = '947.2';
		try {
			const { stdout: psOutput } = await execFileAsync('/usr/bin/pgrep', [
				'-af',
				'grgsm_livemon_headless'
			]);
			const freqMatch = psOutput.match(/-f\s+(\d+\.?\d*)M/);
			if (freqMatch) {
				currentFreq = freqMatch[1];
			}
		} catch (_error: unknown) {
			// pgrep exits 1 when no match — use default frequency
		}

		// Get channel type distribution from monitor service
		let channelInfo = '';
		try {
			// This call uses the in-memory counter of the persistent service
			// instead of spawning a new tshark process every second
			channelInfo = gsmMonitor.getActivityStats();
		} catch (_error: unknown) {
			/* channel type check failed - non-critical */
		}

		return json({
			success: true,
			hasActivity: packets > 0,
			packetCount: packets,
			recentIMSI: recentIMSI,
			currentFrequency: currentFreq,
			message:
				packets > 0 ? `Receiving data (${packets} packets/sec)` : 'No activity detected',
			channelInfo: channelInfo || 'No channel info',
			suggestion:
				packets === 0
					? 'Try different frequencies or check antenna'
					: !recentIMSI && packets > 0
						? 'Receiving control data only - no IMSI broadcasts detected'
						: null
		});
	} catch (error: unknown) {
		logger.error('Activity check error', { error: String(error) });
		return json({
			success: false,
			hasActivity: false,
			message: 'Failed to check activity',
			// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message
		});
	}
};
