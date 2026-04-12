/**
 * POST /api/webtak-vnc/control
 *
 * Start, stop, or check the status of the WebTAK VNC stack
 * (Xtigervnc + chromium + websockify).
 *
 * Body shapes:
 *   { action: "start", url: "https://10.3.1.5:8446" }
 *   { action: "stop" }
 *   { action: "status" }
 */

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getWebtakVncStatus,
	startWebtakVnc,
	stopWebtakVnc
} from '$lib/server/services/webtak-vnc/webtak-vnc-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const WebtakVncControlSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('start'),
		url: z.string().url().describe('TAK server URL to load in the remote Chromium')
	}),
	z.object({ action: z.literal('stop') }),
	z.object({ action: z.literal('status') })
]);

type WebtakVncResult =
	| Awaited<ReturnType<typeof startWebtakVnc | typeof stopWebtakVnc>>
	| ReturnType<typeof getWebtakVncStatus>;

function resultStatus(result: WebtakVncResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

export const POST = createHandler(async ({ request }) => {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return error(400, 'Invalid JSON in request body');
	}
	const validated = safeParseWithHandling(WebtakVncControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid WebTAK VNC control request');

	if (validated.action === 'start') {
		const result = await startWebtakVnc(validated.url);
		return json(result, { status: resultStatus(result) });
	}
	if (validated.action === 'stop') {
		const result = await stopWebtakVnc();
		return json(result, { status: resultStatus(result) });
	}
	return json(getWebtakVncStatus());
});
