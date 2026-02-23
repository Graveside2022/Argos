import { json } from '@sveltejs/kit';

import { execFileAsync } from '$lib/server/exec';
import { gsmMonitor } from '$lib/server/services/gsm-evil/gsm-monitor-service';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

function formatHexDisplay(hex: string): string {
	const formatted = hex.match(/.{1,2}/g)?.join(' ') || hex;
	return formatted.length > 40 ? formatted.substring(0, 40) + '...' : formatted;
}

function formatFrameDisplay(f: { channelType?: string; hex?: string; message?: string }): string {
	const channel = f.channelType || 'UNKNOWN';
	const displayHex = formatHexDisplay(f.hex || '') || '<no data>';
	const message = f.message || 'Unknown Message';
	return `[GSMTAP] ${channel.padEnd(12)} ${displayHex}\n       → ${message}`;
}

async function checkGrgsmProcess(): Promise<boolean> {
	try {
		const grgsm = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless']);
		return grgsm.stdout.trim().length > 0;
	} catch (error: unknown) {
		logger.warn('[gsm-evil-live-frames] GRGSM process check failed', {
			error: String(error)
		});
		return false;
	}
}

export const GET: RequestHandler = async () => {
	try {
		const isRunning = await checkGrgsmProcess();
		if (!isRunning) {
			return json({
				success: false,
				frames: [],
				message: 'GSM monitor not running'
			});
		}

		// Get frames from the persistent service buffer
		const recentFrames = gsmMonitor.getRecentFrames(15);
		const displayFrames = recentFrames.map(formatFrameDisplay);

		if (displayFrames.length === 0) {
			return json({
				success: false,
				frames: [],
				message: 'No frames captured recently'
			});
		}

		return json({
			success: true,
			frames: displayFrames,
			message: `Captured ${displayFrames.length} live frames`,
			timestamp: new Date().toISOString()
		});
	} catch (error: unknown) {
		logger.error('Live frame capture error', { error: (error as Error).message });
		return json({
			success: false,
			frames: [],
			message: 'Failed to capture live frames',
			error: (error as Error).message
		});
	}
};
