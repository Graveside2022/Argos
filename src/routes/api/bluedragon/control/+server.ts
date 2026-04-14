import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { startBluedragon, stopBluedragon } from '$lib/server/services/bluedragon/process-manager';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const BluedragonControlSchema = z.object({
	action: z.enum(['start', 'stop']).describe('Blue Dragon control action'),
	profile: z.enum(['clean', 'volume', 'max']).optional().describe('Tuning profile')
});

export const POST = createHandler(async ({ request }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(BluedragonControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid Blue Dragon control request');

	const { action, profile } = validated;
	const result =
		action === 'start' ? await startBluedragon(profile ?? 'volume') : await stopBluedragon();

	return json(result, { status: result.success ? 200 : 500 });
});
