import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getSpiderfootStatus,
	startSpiderfoot,
	stopSpiderfoot
} from '$lib/server/services/spiderfoot/spiderfoot-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const SpiderfootControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('SpiderFoot control action')
});

type SpiderfootResult = Awaited<ReturnType<typeof startSpiderfoot | typeof getSpiderfootStatus>>;

function resultStatus(result: SpiderfootResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

const ACTION_HANDLERS: Record<string, () => Promise<SpiderfootResult>> = {
	start: startSpiderfoot,
	stop: stopSpiderfoot,
	status: getSpiderfootStatus
};

/**
 * POST /api/spiderfoot/control
 * Start, stop, or check status of SpiderFoot OSINT tool.
 * Body: { action: "start" | "stop" | "status" }
 */
export const POST = createHandler(async ({ request }) => {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return error(400, 'Invalid JSON in request body');
	}
	const validated = safeParseWithHandling(SpiderfootControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid SpiderFoot control request');

	const { action } = validated;
	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
});
