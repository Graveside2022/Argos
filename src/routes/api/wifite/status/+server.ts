import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { wifiteManager } from '$lib/server/wifite/process-manager';
import { resourceManager } from '$lib/server/hardware/resource-manager';

export const GET: RequestHandler = async () => {
	const status = wifiteManager.getStatus();
	const hwStatus = resourceManager.getStatus();
	return json({
		...status,
		alfaOwner: hwStatus.alfa.owner,
		alfaAvailable: hwStatus.alfa.available,
		output: wifiteManager.getOutput().slice(-50),
		lastError: wifiteManager.getLastError(),
		lastRun: status.lastRun
			? {
					...status.lastRun,
					output: status.lastRun.output.slice(-100)
				}
			: null
	});
};
