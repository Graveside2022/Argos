import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getWirelessInterfaces } from '$lib/server/services/sparrow/sparrow-proxy-service';

/**
 * GET /api/sparrow/interfaces
 * Returns list of available WiFi interfaces from Sparrow agent.
 */
export const GET = createHandler(async () => {
	const interfaces = await getWirelessInterfaces();
	return json({ interfaces });
});
