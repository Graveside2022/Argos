import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getDragonSyncStatus } from '$lib/server/services/dragonsync/process-manager';

export const GET = createHandler(async () => {
	const status = await getDragonSyncStatus();
	return json(status);
});
