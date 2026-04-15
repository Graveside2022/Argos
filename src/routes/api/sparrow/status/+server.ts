import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getSparrowStatus } from '$lib/server/services/sparrow/sparrow-control-service';

/**
 * GET /api/sparrow/status
 * Returns current Sparrow-WiFi agent service status for frontend polling.
 */
export const GET = createHandler(async () => {
	const status = await getSparrowStatus();
	return json(status);
});
