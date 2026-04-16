import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getDragonSyncDrones,
	getLastPollError,
	isDragonSyncApiReachable
} from '$lib/server/services/dragonsync/process-manager';

export const GET = createHandler(async () => {
	if (!isDragonSyncApiReachable()) {
		return json(
			{
				success: false,
				drones: [],
				error: getLastPollError() ?? 'DragonSync API unreachable'
			},
			{ status: 503 }
		);
	}
	const drones = getDragonSyncDrones();
	return json({ success: true, drones });
});
