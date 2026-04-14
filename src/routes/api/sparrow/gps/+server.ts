import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getGpsStatus } from '$lib/server/services/sparrow/sparrow-proxy-service';

/**
 * GET /api/sparrow/gps
 * Returns current GPS position from the Sparrow agent.
 */
export const GET = createHandler(async () => {
	const position = await getGpsStatus();
	return json({
		hasPosition: position !== null,
		position
	});
});
