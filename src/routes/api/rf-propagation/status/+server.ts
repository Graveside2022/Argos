/**
 * GET /api/rf-propagation/status
 *
 * Returns CloudRF engine availability status.
 */

import { createHandler } from '$lib/server/api/create-handler';
import { getStatus } from '$lib/server/services/cloudrf/cloudrf-client';

export const GET = createHandler(async () => {
	return getStatus();
});
