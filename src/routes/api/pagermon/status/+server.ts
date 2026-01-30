import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pagermonManager } from '$lib/server/pagermon/processManager';
import { resourceManager } from '$lib/server/hardware/resourceManager';

export const GET: RequestHandler = async () => {
	const status = pagermonManager.getStatus();
	const hwStatus = resourceManager.getStatus();
	return json({
		...status,
		hackrfOwner: hwStatus.hackrf.owner,
		hackrfAvailable: hwStatus.hackrf.available
	});
};
