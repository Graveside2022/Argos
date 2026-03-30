import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import type {
	BluehoodControlResult,
	BluehoodStatusResult
} from '$lib/server/services/bluehood/bluehood-control-service';
import {
	getBluehoodStatus,
	startBluehood,
	stopBluehood
} from '$lib/server/services/bluehood/bluehood-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const BluehoodControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('BlueHood control action')
});

const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
	start: { success: true, message: 'BlueHood started (mock mode)' },
	stop: { success: true, message: 'BlueHood stopped (mock mode)' },
	status: { success: true, isRunning: false, status: 'inactive', port: 8085 }
};

type AnyBluehoodResult = BluehoodControlResult | BluehoodStatusResult;

function resultStatus(result: AnyBluehoodResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

const ACTION_HANDLERS: Record<string, () => Promise<AnyBluehoodResult>> = {
	start: startBluehood,
	stop: stopBluehood,
	status: getBluehoodStatus
};

/**
 * POST /api/bluehood/control
 * Start, stop, or check status of BlueHood BLE scanner service.
 * Automatically stops Kismet if running (shared hci0 adapter conflict guard).
 * Body: { action: "start" | "stop" | "status" }
 */
export const POST = createHandler(async ({ request, url }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(BluehoodControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid BlueHood control request');

	const { action } = validated;
	if (url.searchParams.get('mock') === 'true') return json(MOCK_RESPONSES[action]);

	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
});
