import { json } from '@sveltejs/kit';

import { hostExec } from '$lib/server/host-exec';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Check if grgsm_livemon is running
		const grgsm = await hostExec('pgrep -f grgsm_livemon_headless').catch((error: unknown) => {
			console.warn('[gsm-evil-frames] GRGSM process check failed', { error: String(error) });
			return { stdout: '' };
		});
		if (!grgsm.stdout.trim()) {
			return json({
				success: false,
				frames: [],
				message: 'GSM monitor not running'
			});
		}

		// Read GSM frames from the log file where grgsm_livemon outputs them
		const logPath = '/tmp/grgsm_scan.log';
		const { stdout: recentFrames } = await hostExec(
			`tail -10 ${logPath} | grep -E "^\\s*[0-9a-f]{2}\\s"`,
			{ timeout: 2000 }
		).catch((error: unknown) => {
			console.warn('[gsm-evil-frames] Frame log read failed', { error: String(error) });
			return { stdout: '' };
		});

		let frames: string[] = [];

		if (recentFrames) {
			// Each line contains GSM frame hex data
			const lines = recentFrames.split('\n').filter((line) => line.trim().length > 0);

			frames = lines
				.slice(-5)
				.map((line) => {
					// Clean up the line and format it nicely
					const hexData = line.trim();

					if (hexData.length >= 10) {
						// Classify GSM L3 frame by message type (byte[2] with byte[1]=0x06 = RR management)
						let frameType = '';
						const bytes = hexData.split(/\s+/);
						const msgType =
							bytes.length >= 3 && bytes[1] === '06' ? parseInt(bytes[2], 16) : -1;

						if (bytes.length >= 3 && bytes[1] === '06') {
							switch (msgType) {
								case 0x19:
									frameType = ' [SI1]';
									break;
								case 0x1a:
									frameType = ' [SI2]';
									break;
								case 0x1b:
									frameType = ' [SI3]';
									break;
								case 0x1c:
									frameType = ' [SI4]';
									break;
								case 0x1d:
									frameType = ' [SI5]';
									break;
								case 0x1e:
									frameType = ' [SI6]';
									break;
								case 0x02:
									frameType = ' [SI2bis]';
									break;
								case 0x03:
									frameType = ' [SI2ter]';
									break;
								case 0x07:
									frameType = ' [SI2quat]';
									break;
								case 0x21:
									frameType = ' [PAGING1]';
									break;
								case 0x22:
									frameType = ' [PAGING2]';
									break;
								case 0x24:
									frameType = ' [PAGING3]';
									break;
								case 0x3e:
									frameType = ' [IMM_ASSIGN]';
									break;
								case 0x3f:
									frameType = ' [IMM_ASSIGN_EXT]';
									break;
								default:
									frameType = ' [RR]';
									break;
							}
						} else if (hexData.includes('2b 2b 2b 2b 2b 2b 2b 2b 2b')) {
							frameType = ' [FILL]';
						} else {
							frameType = ' [DATA]';
						}

						// Limit display to first 48 characters for readability
						const displayData =
							hexData.length > 48 ? hexData.substring(0, 48) + '...' : hexData;
						return displayData + frameType;
					}
					return '';
				})
				.filter((f) => f.length > 0);
		}

		// If no frames captured, return empty array with message
		if (frames.length === 0) {
			return json({
				success: false,
				frames: [],
				message: 'No GSM frames captured - check if data is flowing'
			});
		}

		return json({
			success: true,
			frames: frames,
			message: frames.length > 0 ? 'Live frames captured' : 'No frames detected'
		});
	} catch (error: unknown) {
		console.error('Frame capture error:', error);
		return json({
			success: false,
			frames: [],
			message: 'Failed to capture frames',
			// Safe: Catch block error cast to Error for message extraction
			// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message
		});
	}
};
