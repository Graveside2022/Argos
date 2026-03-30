import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getBluehoodStatus } from '$lib/server/services/bluehood/bluehood-control-service';

/**
 * GET /api/bluehood/status
 * Returns current BlueHood service status for frontend polling.
 */
export const GET = createHandler(async () => {
	const status = await getBluehoodStatus();
	return json(status);
});
