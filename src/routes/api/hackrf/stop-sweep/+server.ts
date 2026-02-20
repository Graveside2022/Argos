import { json } from '@sveltejs/kit';

import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		// Stop the sweep using sweepManager
		await sweepManager.stopSweep();

		return json({
			status: 'success',
			message: 'Sweep stopped successfully'
		});
	} catch (error: unknown) {
		logger.error('Error in stop-sweep endpoint', {
			error: error instanceof Error ? error.message : String(error)
		});
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Failed to stop sweep'
			},
			{ status: 500 }
		);
	}
};
