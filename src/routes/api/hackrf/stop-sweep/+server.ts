import { createHandler } from '$lib/server/api/create-handler';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';

export const POST = createHandler(async () => {
	await sweepManager.stopSweep();
	return { status: 'success', message: 'Sweep stopped successfully' };
});
