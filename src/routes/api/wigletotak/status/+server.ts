import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getWigleTotakStatus } from '$lib/server/services/wigletotak/wigletotak-control-service';

/**
 * GET /api/wigletotak/status
 * Returns current WigleToTAK process status for frontend polling.
 */
export const GET = createHandler(async () => {
	const status = await getWigleTotakStatus();
	return json(status);
});
