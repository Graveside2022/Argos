import { createHandler } from '$lib/server/api/create-handler';
import { getStatus } from '$lib/server/services/trunk-recorder/service';

/** GET /api/trunk-recorder/status — current container + HackRF ownership. */
export const GET = createHandler(async () => {
	const status = await getStatus();
	return { success: true, ...status };
});
