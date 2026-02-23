import { createHandler } from '$lib/server/api/create-handler';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';

export const POST = createHandler(async () => {
	await sweepManager.emergencyStop();
	return { success: true, data: { stopped: true }, timestamp: Date.now() };
});
