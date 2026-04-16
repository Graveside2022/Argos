import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getDragonSyncFpvSignals,
	getLastPollError,
	isDragonSyncApiReachable
} from '$lib/server/services/dragonsync/process-manager';

export const GET = createHandler(async () => {
	if (!isDragonSyncApiReachable()) {
		return json(
			{
				success: false,
				signals: [],
				error: getLastPollError() ?? 'DragonSync API unreachable'
			},
			{ status: 503 }
		);
	}
	const signals = getDragonSyncFpvSignals();
	return json({ success: true, signals });
});
