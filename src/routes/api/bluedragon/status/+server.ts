import { json } from '@sveltejs/kit';

import { createHandler } from '$lib/server/api/create-handler';
import { getBluedragonStatusSync } from '$lib/server/services/bluedragon/process-manager';

export const GET = createHandler(async () => {
	return json(getBluedragonStatusSync());
});
