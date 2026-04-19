import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { startBluedragon, stopBluedragon } from '$lib/server/services/bluedragon/process-manager';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const BluedragonOptionsSchema = z
	.object({
		allChannels: z.boolean().optional(),
		activeScan: z.boolean().optional(),
		gpsd: z.boolean().optional(),
		codedScan: z.boolean().optional()
	})
	.optional();

const BluedragonControlSchema = z.object({
	action: z.enum(['start', 'stop']).describe('Blue Dragon control action'),
	profile: z.enum(['clean', 'volume', 'max']).optional().describe('Tuning profile'),
	options: BluedragonOptionsSchema.describe('Optional capture toggles')
});

async function parseJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return error(400, 'Invalid JSON body');
	}
}

type ControlInput = z.infer<typeof BluedragonControlSchema>;

async function dispatchAction(input: ControlInput) {
	if (input.action === 'start') {
		return startBluedragon(input.profile ?? 'volume', input.options ?? {});
	}
	return stopBluedragon();
}

export const POST = createHandler(async ({ request }) => {
	const rawBody = await parseJsonBody(request);
	const validated = safeParseWithHandling(BluedragonControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid Blue Dragon control request');

	const result = await dispatchAction(validated);
	return json(result, { status: result.success ? 200 : 500 });
});
