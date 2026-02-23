import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { getSweepManager } from '$lib/server/hackrf/sweep-manager';
import { SystemStatus } from '$lib/types/enums';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		const manager = getSweepManager();
		const status = manager.getStatus();

		return json({
			connected: status.state !== SystemStatus.Idle,
			sweeping: status.state === SystemStatus.Running,
			deviceInfo: null,
			currentFrequency: status.currentFrequency || null,
			sweepConfig: { startFreq: null, stopFreq: null, binWidth: null },
			status: status,
			timestamp: Date.now()
		});
	} catch (error: unknown) {
		logger.error('Error getting HackRF status', { error: errMsg(error) });
		// Return 200 even on error to avoid breaking SSE
		return json({
			connected: false,
			sweeping: false,
			deviceInfo: null,
			currentFrequency: null,
			sweepConfig: null,
			status: { state: SystemStatus.Error },
			timestamp: Date.now(),
			error: errMsg(error)
		});
	}
};
