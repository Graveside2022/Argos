import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/host-exec';

export const GET: RequestHandler = async () => {
	try {
		// Check if grgsm_livemon is running
		const grgsm = await hostExec('pgrep -f grgsm_livemon_headless').catch((error: unknown) => {
			console.debug('[gsm-evil-live-frames] GRGSM process check failed', {
				error: String(error)
			});
			return { stdout: '' };
		});
		if (!grgsm.stdout.trim()) {
			return json({
				success: false,
				frames: [],
				message: 'GSM monitor not running'
			});
		}

		// Capture live GSMTAP packets using tshark standard output with hex data
		const [tsharkTextOutput, tsharkHexOutput] = await Promise.all([
			// Get decoded text
			hostExec(
				'timeout 3 tshark -i lo -f "udp port 4729" -c 20 2>&1 | grep -E "GSMTAP|LAPDm" || true',
				{ timeout: 4000 }
			).catch((err) => {
				console.error('[live-frames] Text capture ERROR:', String(err));
				console.error('[live-frames] Error details:', JSON.stringify(err, null, 2));
				return { stdout: '', stderr: String(err) };
			}),
			// Get hex data separately
			hostExec(
				'timeout 3 tshark -i lo -f "udp port 4729" -T fields -e gsmtap -e data.data -c 20 2>/dev/null || true',
				{ timeout: 4000 }
			).catch((err) => {
				console.error('[live-frames] Hex capture ERROR:', String(err));
				return { stdout: '', stderr: String(err) };
			})
		]);

		let frames: string[] = [];

		const textLines = tsharkTextOutput.stdout.split('\n').filter((l) => l.trim());
		const hexLines = tsharkHexOutput.stdout.split('\n').filter((l) => l.trim());

		if (textLines.length > 0) {
			frames = textLines
				.slice(-15)
				.map((line, idx) => {
					// Parse tshark standard output format:
					// "    1 0.000000000    127.0.0.1 → 127.0.0.1    GSMTAP 81 (CCCH) (RR) System Information Type 13"

					// Extract channel type and message
					const gsmtapMatch = line.match(/GSMTAP\s+\d+\s+\(([^)]+)\)\s+(.+)/);
					const lapdmMatch = line.match(/LAPDm\s+\d+\s+(.+)/);

					if (gsmtapMatch) {
						const channel = gsmtapMatch[1];
						const message = gsmtapMatch[2];

						// Try to get corresponding hex data
						const hexLine = hexLines[idx] || '';
						const hexParts = hexLine.split('\t');
						const hexData = hexParts.length >= 2 ? hexParts[1] : '';

						// Format hex (limit to 40 chars)
						const formatted = hexData.match(/.{1,2}/g)?.join(' ') || hexData;
						const displayHex =
							formatted.length > 40 ? formatted.substring(0, 40) + '...' : formatted;

						// Build frame display with L3 decode
						return `[GSMTAP] ${channel.padEnd(12)} ${displayHex || '<no data>'}\n       → ${message}`;
					} else if (lapdmMatch) {
						const message = lapdmMatch[1];

						// Try to get hex data
						const hexLine = hexLines[idx] || '';
						const hexParts = hexLine.split('\t');
						const hexData = hexParts.length >= 2 ? hexParts[1] : '';

						const formatted = hexData.match(/.{1,2}/g)?.join(' ') || hexData;
						const displayHex =
							formatted.length > 40 ? formatted.substring(0, 40) + '...' : formatted;

						return `[LAPDm]  Layer 2       ${displayHex || '<no data>'}\n       → ${message}`;
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
				message: 'No GSMTAP frames captured in the last 3 seconds'
			});
		}

		return json({
			success: true,
			frames: frames,
			message: `Captured ${frames.length} live frames`,
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
