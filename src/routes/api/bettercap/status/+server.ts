import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import * as bettercapClient from '$lib/server/bettercap/apiClient';
import { resourceManager } from '$lib/server/hardware/resourceManager';

export const GET: RequestHandler = async () => {
	try {
		const running = await bettercapClient.isContainerRunning();
		const session = running ? await bettercapClient.getSession() : null;
		const hwStatus = resourceManager.getStatus();

		return json({
			running,
			session,
			alfaOwner: hwStatus.alfa.owner,
			alfaAvailable: hwStatus.alfa.available
		});
	} catch (error) {
		return json({ running: false, error: (error as Error).message }, { status: 500 });
	}
};
