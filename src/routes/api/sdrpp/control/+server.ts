import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { withWebRxLock } from '$lib/server/api/webrx-control-lock';
import { acquireHackRfForWebRx, releaseHackRfForWebRx } from '$lib/server/api/webrx-hackrf-claim';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import {
	getSdrppVncStatus,
	startSdrppVnc,
	stopSdrppVnc
} from '$lib/server/services/sdrpp/sdrpp-vnc-control-service';
import { logger } from '$lib/utils/logger';

const TOOL_NAME = 'sdrpp';

const ControlActionSchema = z.object({
	action: z.enum(['start', 'stop', 'restart', 'status'])
});
type ControlBody = z.infer<typeof ControlActionSchema>;
type ControlAction = ControlBody['action'];

/** Check VNC running status and report the current HackRF owner. */
function handleStatus(): Response {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	const vncStatus = getSdrppVncStatus();
	return json({
		success: true,
		running: vncStatus.isRunning,
		status: vncStatus.isRunning ? 'running' : 'stopped',
		owner,
		wsPort: vncStatus.wsPort,
		wsPath: vncStatus.wsPath
	});
}

/** Build the 409 Conflict response for a failed HackRF acquire. */
function buildConflictResponse(claim: { owner?: string; message?: string }): Response {
	return json(
		{
			success: false,
			error: claim.message,
			conflictingService: claim.owner
		},
		{ status: 409 }
	);
}

/** Start the SDR++ VNC stack, acquiring the HackRF first. */
async function handleStart(): Promise<Response> {
	return withWebRxLock(async () => {
		const claim = await acquireHackRfForWebRx(TOOL_NAME);
		if (!claim.success) return buildConflictResponse(claim);

		const vncResult = await startSdrppVnc();
		if (!vncResult.success) {
			logger.error('[sdrpp-control] VNC start failed, releasing HackRF claim');
			await releaseHackRfForWebRx(TOOL_NAME);
			return json(
				{ success: false, error: 'Failed to start SDR++ VNC stack' },
				{ status: 500 }
			);
		}

		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		return json({
			success: true,
			action: 'start',
			message: 'SDR++ started successfully',
			wsPort: vncResult.wsPort,
			wsPath: vncResult.wsPath
		});
	});
}

/** Stop the SDR++ VNC stack and release the HackRF. */
async function handleStop(): Promise<Response> {
	return withWebRxLock(async () => {
		await stopSdrppVnc();
		await releaseHackRfForWebRx(TOOL_NAME);
		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		return json({
			success: true,
			action: 'stop',
			message: 'SDR++ stopped successfully'
		});
	});
}

/** Restart: stop then start. */
async function handleRestart(): Promise<Response> {
	return withWebRxLock(async () => {
		// Stop phase
		await stopSdrppVnc();
		await releaseHackRfForWebRx(TOOL_NAME);

		// Start phase
		const claim = await acquireHackRfForWebRx(TOOL_NAME);
		if (!claim.success) return buildConflictResponse(claim);

		const vncResult = await startSdrppVnc();
		if (!vncResult.success) {
			logger.error(
				'[sdrpp-control] VNC restart failed during start phase, releasing HackRF claim'
			);
			await releaseHackRfForWebRx(TOOL_NAME);
			return json(
				{ success: false, error: 'Failed to restart SDR++ VNC stack' },
				{ status: 500 }
			);
		}

		await resourceManager.refreshNow(HardwareDevice.HACKRF);
		return json({
			success: true,
			action: 'restart',
			message: 'SDR++ restarted successfully',
			wsPort: vncResult.wsPort,
			wsPath: vncResult.wsPath
		});
	});
}

/** Execute validated SDR++ action. */
function executeAction(action: ControlAction): Response | Promise<Response> {
	switch (action) {
		case 'status':
			return handleStatus();
		case 'start':
			return handleStart();
		case 'stop':
			return handleStop();
		case 'restart':
			return handleRestart();
	}
}

/**
 * POST /api/sdrpp/control
 * Control SDR++ via VNC stack. Shares the HackRF with OpenWebRX / NovaSDR
 * via the ResourceManager singleton — starting SDR++ while another tool
 * holds the HackRF will auto-stop the peer and reclaim, while starting
 * SDR++ while a non-peer tool holds it returns 409 Conflict.
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST = createHandler(
	async ({ request }) => {
		const { action } = (await request.json()) as ControlBody;
		return executeAction(action);
	},
	{ validateBody: ControlActionSchema }
);
