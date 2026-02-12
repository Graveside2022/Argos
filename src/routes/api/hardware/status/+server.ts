import { json } from '@sveltejs/kit';

import { resourceManager } from '$lib/server/hardware/resource-manager';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const status = resourceManager.getStatus();
	return json(status);
};
