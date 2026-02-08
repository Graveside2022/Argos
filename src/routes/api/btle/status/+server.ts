import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { btleManager } from '$lib/server/btle/process-manager';
import { resourceManager } from '$lib/server/hardware/resource-manager';

export const GET: RequestHandler = async () => {
	const status = btleManager.getStatus();
	const hwStatus = resourceManager.getStatus();
	return json({
		...status,
		hackrfOwner: hwStatus.hackrf.owner,
		hackrfAvailable: hwStatus.hackrf.available
	});
};
