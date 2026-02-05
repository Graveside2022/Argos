import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/hostExec';

export const GET: RequestHandler = async () => {
	try {
		// Check if grgsm_livemon is running
		const grgsm = await hostExec('pgrep -f grgsm_livemon_headless').catch(() => ({
			stdout: ''
		}));
		if (!grgsm.stdout.trim()) {
			return json({
				success: false,
				hasActivity: false,
				message: 'GSM monitor not running'
			});
		}

		// Check for recent GSMTAP activity on port 4729
		const { stdout: tcpdumpOutput } = await hostExec(
			'sudo timeout 1 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l',
			{ timeout: 3000 }
		).catch(() => ({ stdout: '0' }));

		const packets = parseInt(tcpdumpOutput.trim()) || 0;

		// Check for recent IMSI database activity on the host
		let recentIMSI = false;
		try {
			const { stdout: dbAge } = await hostExec(
				'find /usr/src/gsmevil2/database/imsi.db -mmin -5 2>/dev/null | head -1'
			).catch(() => ({ stdout: '' }));
			recentIMSI = dbAge.trim().length > 0;
		} catch (_error: unknown) {
			recentIMSI = false;
		}

		// Get current frequency from process
		const { stdout: psOutput } = await hostExec(
			'ps aux | grep grgsm_livemon_headless | grep -v grep'
		).catch(() => ({ stdout: '' }));
		let currentFreq = '947.2';
		const freqMatch = psOutput.match(/-f\s+(\d+\.?\d*)M/);
		if (freqMatch) {
			currentFreq = freqMatch[1];
		}

		// Get channel type distribution
		let channelInfo = '';
		try {
			const { stdout: channelTypes } = await hostExec(
				'sudo timeout 1 tshark -i lo -f "port 4729" -T fields -e gsmtap.chan_type 2>/dev/null | sort | uniq -c | head -3'
			).catch(() => ({ stdout: '' }));

			if (channelTypes) {
				channelInfo = channelTypes.trim().replace(/\n/g, ', ');
			}
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
		console.error('Activity check error:', error);
		return json({
			success: false,
			hasActivity: false,
			message: 'Failed to check activity',
			error: (error as Error).message
		});
	}
};
