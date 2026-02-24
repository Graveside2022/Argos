import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { errMsg } from '$lib/server/api/error-utils';
import {
	getKismetStatus,
	startKismetExtended,
	stopKismetExtended
} from '$lib/server/services/kismet/kismet-control-service-extended';
import { safeParseWithHandling } from '$lib/utils/validation-error';

import type { RequestHandler } from './$types';

const KismetControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('Kismet control action')
});

/**
 * POST /api/kismet/control
 * Start, stop, or check status of Kismet WiFi discovery service
 * Body: { action: "start" | "stop" | "status" }
 * Query: ?mock=true for mock responses (testing)
 */
const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
	start: {
		success: true,
		message: 'Kismet service started (mock mode)',
		details: 'Mock Kismet process started successfully'
	},
	stop: { success: true, message: 'Kismet stopped gracefully (mock mode)' },
	status: { success: true, isRunning: false, status: 'inactive' }
};

type KismetResult = { success: boolean; error?: string };

function resultStatus(result: KismetResult): number {
	if (result.success) return 200;
	return result.error ? 400 : 500;
}

const ACTION_HANDLERS: Record<string, () => Promise<KismetResult>> = {
	start: startKismetExtended,
	stop: stopKismetExtended,
	status: getKismetStatus
};

async function executeKismetAction(action: string) {
	const handler = ACTION_HANDLERS[action];
	const result = await handler();
	return action === 'status' ? json(result) : json(result, { status: resultStatus(result) });
}

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const rawBody = await request.json();
		const validated = safeParseWithHandling(KismetControlSchema, rawBody, 'user-action');
		if (!validated) return error(400, 'Invalid Kismet control request');

		const { action } = validated;
		if (url.searchParams.get('mock') === 'true') return json(MOCK_RESPONSES[action]);

		return await executeKismetAction(action);
	} catch (err: unknown) {
		return json(
			{
				success: false,
				message: 'Server error',
				error: errMsg(err)
			},
			{ status: 500 }
		);
	}
};
