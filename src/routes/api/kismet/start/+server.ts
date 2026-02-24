import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { startKismet } from '$lib/server/services/kismet/kismet-control-service';

/**
 * POST /api/kismet/start
 * Starts Kismet WiFi discovery service
 */
export const POST = createHandler(async () => {
	const result = await startKismet();

	if (!result.success) {
		return json(result, { status: 500 });
	}

	return result;
});
