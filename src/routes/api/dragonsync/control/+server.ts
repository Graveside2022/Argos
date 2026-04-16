import { error, json } from '@sveltejs/kit';

import { DragonSyncControlSchema } from '$lib/schemas/dragonsync';
import { createHandler } from '$lib/server/api/create-handler';
import { startDragonSync, stopDragonSync } from '$lib/server/services/dragonsync/process-manager';
import { safeParseWithHandling } from '$lib/utils/validation-error';

async function parseJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return error(400, 'Invalid JSON body');
	}
}

export const POST = createHandler(async ({ request }) => {
	const rawBody = await parseJsonBody(request);
	const validated = safeParseWithHandling(DragonSyncControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid DragonSync control request');

	const { action } = validated;
	const result = action === 'start' ? await startDragonSync() : await stopDragonSync();

	return json(result, { status: result.success ? 200 : 500 });
});
