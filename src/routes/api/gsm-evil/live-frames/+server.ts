import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { gsmMonitor } from '$lib/server/services/gsm-evil/gsm-monitor-service';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async () => {
	try {
		// Check if grgsm_livemon is running (still needed to know if radio is active)
		let grgsm: { stdout: string };
		try {
			grgsm = await execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless']);
		} catch (error: unknown) {
			// pgrep exits 1 when no processes match — not a real error
			console.warn('[gsm-evil-live-frames] GRGSM process check failed', {
				error: String(error)
			});
			grgsm = { stdout: '' };
		}

		if (!grgsm.stdout.trim()) {
			return json({
				success: false,
				frames: [],
				message: 'GSM monitor not running'
			});
		}

		// Get frames from the persistent service buffer
		const recentFrames = gsmMonitor.getRecentFrames(15);

		const displayFrames = recentFrames.map((f) => {
			const channel = f.channelType || 'UNKNOWN';

			// Format hex (limit to 40 chars)
			const hexData = f.hex || '';
			const formatted = hexData.match(/.{1,2}/g)?.join(' ') || hexData;
			const displayHex =
				formatted.length > 40 ? formatted.substring(0, 40) + '...' : formatted;

			return `[GSMTAP] ${channel.padEnd(12)} ${displayHex || '<no data>'}\n       → ${f.message || 'Unknown Message'}`;
		});

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
		console.error('Live frame capture error:', error);
		return json({
			success: false,
			frames: [],
			message: 'Failed to capture live frames',
			error: (error as Error).message
		});
	}
};
