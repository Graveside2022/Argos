import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { resourceManager } from '$lib/server/hardware/resource-manager';

/**
 * GET /api/sdr/locks
 * Returns current SDR/hardware ownership state so the dashboard can show
 * which tool currently holds HackRF / B205 / Alfa / Bluetooth.
 */
export const GET = createHandler(async () => {
	const status = resourceManager.getStatus();
	return json({ success: true, status });
});
