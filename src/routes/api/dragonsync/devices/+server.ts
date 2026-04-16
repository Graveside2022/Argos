import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getDragonSyncDrones } from '$lib/server/services/dragonsync/process-manager';

export const GET = createHandler(async () => {
	const drones = getDragonSyncDrones();
	return json({ success: true, drones });
});
