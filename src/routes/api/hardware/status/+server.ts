import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resourceManager } from '$lib/server/hardware/resource-manager';

export const GET: RequestHandler = async () => {
	const status = resourceManager.getStatus();
	return json(status);
};
