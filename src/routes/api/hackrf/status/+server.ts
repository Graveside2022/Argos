import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSweepManager } from '$lib/server/hackrf/sweepManager';
import { SystemStatus } from '$lib/types/enums';

export const GET: RequestHandler = () => {
	try {
		const manager = getSweepManager();
		const status = manager.getStatus();

		return json({
			connected: status.state !== SystemStatus.Idle,
			sweeping: status.state === SystemStatus.Running,
			deviceInfo: null, // Not available in current implementation
			currentFrequency: status.currentFrequency || null,
			sweepConfig: {
				startFreq: null,
				stopFreq: null,
				binWidth: null
			},
			status: status,
			timestamp: Date.now()
		});
	} catch (error: unknown) {
		console.error('Error getting HackRF status:', error);
		return json(
			{
				connected: false,
				sweeping: false,
				deviceInfo: null,
				currentFrequency: null,
				sweepConfig: null,
				status: { state: SystemStatus.Error },
				timestamp: Date.now(),
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 200 }
		); // Return 200 even on error to avoid breaking SSE
	}
};
