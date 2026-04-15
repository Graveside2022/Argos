import { error, json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import {
	getSparrowStatus,
	startSparrow,
	stopSparrow
} from '$lib/server/services/sparrow/sparrow-control-service';
import {
	getSparrowVncStatus,
	startSparrowVnc,
	stopSparrowVnc
} from '$lib/server/services/sparrow/sparrow-vnc-control-service';
import { safeParseWithHandling } from '$lib/utils/validation-error';

const SparrowControlSchema = z.object({
	action: z.enum(['start', 'stop', 'status']).describe('Sparrow-WiFi control action')
});

const MOCK_RESPONSES: Record<string, Record<string, unknown>> = {
	start: { success: true, message: 'Sparrow-WiFi started (mock mode)' },
	stop: { success: true, message: 'Sparrow-WiFi stopped (mock mode)' },
	status: { success: true, isRunning: false, status: 'inactive', port: 8020 }
};

/** Combined status from agent + VNC stack. */
async function handleStatus() {
	const agentStatus = await getSparrowStatus();
	const vncStatus = getSparrowVncStatus();
	return json({
		success: true,
		isRunning: agentStatus.isRunning || vncStatus.isRunning,
		status: agentStatus.isRunning || vncStatus.isRunning ? 'active' : 'inactive',
		agent: agentStatus,
		vnc: vncStatus
	});
}

/** Build a combined result from agent + VNC outcomes. */
function buildResult(
	agentOk: boolean,
	vncOk: boolean,
	verb: string,
	extra?: Record<string, unknown>
) {
	const success = agentOk && vncOk;
	const message = success
		? `Sparrow-WiFi ${verb} (agent + GUI)`
		: `Partial ${verb}: agent=${agentOk}, vnc=${vncOk}`;
	return json({ success, message, ...extra }, { status: success ? 200 : 400 });
}

/** Start both agent (systemd) and VNC GUI stack. */
async function handleStart() {
	const agentResult = await startSparrow();
	const vncResult = await startSparrowVnc();
	return buildResult(agentResult.success, vncResult.success, 'started', {
		wsPort: vncResult.wsPort,
		wsPath: vncResult.wsPath
	});
}

/** Stop both VNC GUI stack and agent. */
async function handleStop() {
	const vncResult = await stopSparrowVnc();
	const agentResult = await stopSparrow();
	return buildResult(agentResult.success, vncResult.success, 'stopped');
}

const ACTION_HANDLERS: Record<string, () => Promise<Response>> = {
	start: handleStart,
	stop: handleStop,
	status: handleStatus
};

/**
 * POST /api/sparrow/control
 * Start, stop, or check status of Sparrow-WiFi (agent + VNC GUI stack).
 * Body: { action: "start" | "stop" | "status" }
 */
export const POST = createHandler(async ({ request, url }) => {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const validated = safeParseWithHandling(SparrowControlSchema, rawBody, 'user-action');
	if (!validated) throw error(400, 'Invalid Sparrow-WiFi control request');

	const { action } = validated;
	if (url.searchParams.get('mock') === 'true') return json(MOCK_RESPONSES[action]);

	return ACTION_HANDLERS[action]();
});
