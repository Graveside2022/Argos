import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	try {
		await sweepManager.stopSweep();
		return json({ status: 'success', message: 'Sweep stopped successfully' });
	} catch (error: unknown) {
		const msg = errMsg(error);
		logger.error('Error in stop-sweep endpoint', { error: msg });
		return json({ status: 'error', message: msg }, { status: 500 });
	}
};
