import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getSightlineStatus,
	startSightline,
	stopSightline
} from '$lib/server/services/sightline/sightline-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const SightlineControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('Sightline control action')
});

type SightlineResult = Awaited<ReturnType<typeof startSightline | typeof getSightlineStatus>>;

function resultStatus(result: SightlineResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

const ACTION_HANDLERS: Record<string, () => Promise<SightlineResult>> = {
	start: startSightline,
	stop: stopSightline,
	status: getSightlineStatus
};

/**
 * POST /api/sightline/control
 * Start, stop, or check status of Sightline OSINT tool.
 * Body: { action: "start" | "stop" | "status" }
 */
export const POST = createHandler(async ({ request }) => {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return error(400, 'Invalid JSON in request body');
	}
	const validated = safeParseWithHandling(SightlineControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid Sightline control request');

	const { action } = validated;
	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
});
