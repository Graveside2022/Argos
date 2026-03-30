import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import type {
	WigleTotakControlResult,
	WigleTotakStatusResult
} from '$lib/server/services/wigletotak/wigletotak-control-service';
import {
	getWigleTotakStatus,
	startWigleToTak,
	stopWigleToTak
} from '$lib/server/services/wigletotak/wigletotak-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const WigleTotakControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('WigleToTAK control action')
});

const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
	start: { success: true, message: 'WigleToTAK started (mock mode)' },
	stop: { success: true, message: 'WigleToTAK stopped (mock mode)' },
	status: { success: true, isRunning: false, status: 'inactive', port: 5000 }
};

type AnyResult = WigleTotakControlResult | WigleTotakStatusResult;

function resultStatus(result: AnyResult): number {
	if (result.success) return 200;
	return 'error' in result && result.error ? 400 : 500;
}

const ACTION_HANDLERS: Record<string, () => Promise<AnyResult>> = {
	start: startWigleToTak,
	stop: stopWigleToTak,
	status: getWigleTotakStatus
};

/**
 * POST /api/wigletotak/control
 * Start, stop, or check status of the WigleToTAK Flask process.
 * Body: { action: "start" | "stop" | "status" }
 */
export const POST = createHandler(async ({ request, url }) => {
	const rawBody = await request.json();
	const validated = safeParseWithHandling(WigleTotakControlSchema, rawBody, 'user-action');
	if (!validated) return error(400, 'Invalid WigleToTAK control request');

	const { action } = validated;
	if (url.searchParams.get('mock') === 'true') return json(MOCK_RESPONSES[action]);

	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
});
