import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { withWebRxLock } from '$lib/server/api/webrx-control-lock';
import { acquireHackRfForWebRx, releaseHackRfForWebRx } from '$lib/server/api/webrx-hackrf-claim';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { delay } from '$lib/utils/delay';

const CONTAINER_NAME = 'openwebrx-hackrf';
const TOOL_NAME = 'openwebrx';

const ControlActionSchema = z.object({
	action: z.enum(['start', 'stop', 'restart', 'status'])
});
type ControlBody = z.infer<typeof ControlActionSchema>;
type ControlAction = ControlBody['action'];

/** Check container running status and report the current HackRF owner. */
async function getContainerStatus(): Promise<Response> {
	const owner = resourceManager.getOwner(HardwareDevice.HACKRF);
	try {
		const { stdout } = await execFileAsync('docker', [
			'ps',
			'--filter',
			`name=${CONTAINER_NAME}`,
			'--format',
			'{{.State}}'
		]);
		const running = stdout.trim() === 'running';
		return json({
			success: true,
			running,
			status: running ? 'running' : 'stopped',
			owner
		});
	} catch {
		return json({ success: true, running: false, status: 'stopped', owner });
	}
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

/** Run `docker <action> openwebrx-hackrf` and release the HackRF claim on failure. */
async function runDockerAction(
	action: Exclude<ControlAction, 'status'>,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	try {
		await execFileAsync('docker', [action, CONTAINER_NAME]);
		if (action === 'start') await delay(2000);
		if (action === 'stop') await releaseHackRfForWebRx(TOOL_NAME);
		return json({ success: true, action, message, ...extra });
	} catch (err) {
		// Release the claim so the HackRF isn't orphaned in the registry
		// when docker start (or any lifecycle command) fails mid-operation.
		if (action === 'start') await releaseHackRfForWebRx(TOOL_NAME);
		throw err;
	}
}

/**
 * Execute a docker lifecycle command inside the shared WebRX lock.
 *
 * `start` acquires the HackRF via ResourceManager (auto-stops the peer WebSDR
 * if it's currently holding the device). `stop` releases the HackRF after
 * the container is down. Any docker failure releases the claim so the
 * registry isn't left in an orphaned state.
 */
async function dockerLifecycle(
	action: Exclude<ControlAction, 'status'>,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	return withWebRxLock(async () => {
		if (action === 'start') {
			const claim = await acquireHackRfForWebRx(TOOL_NAME);
			if (!claim.success) return buildConflictResponse(claim);
		}
		return runDockerAction(action, message, extra);
	});
}

const LIFECYCLE_EXTRAS: Record<ControlAction, Record<string, unknown> | undefined> = {
	start: { url: env.OPENWEBRX_URL },
	stop: undefined,
	restart: undefined,
	status: undefined
};

const LIFECYCLE_MESSAGES: Record<Exclude<ControlAction, 'status'>, string> = {
	start: 'OpenWebRX started successfully',
	stop: 'OpenWebRX stopped successfully',
	restart: 'OpenWebRX restarted successfully'
};

/** Execute validated OpenWebRX action. */
function executeAction(action: ControlAction): Promise<Response> {
	if (action === 'status') return getContainerStatus();
	return dockerLifecycle(action, LIFECYCLE_MESSAGES[action], LIFECYCLE_EXTRAS[action]);
}

/**
 * POST /api/openwebrx/control
 * Control OpenWebRX Docker container. Shares a HackRF with NovaSDR via the
 * ResourceManager singleton — starting OpenWebRX while NovaSDR holds the
 * HackRF will auto-stop NovaSDR and reclaim, while starting OpenWebRX while
 * GSM Evil or any other non-peer tool holds it returns 409 Conflict.
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST = createHandler(
	async ({ request }) => {
		const { action } = (await request.json()) as ControlBody;
		return executeAction(action);
	},
	{ validateBody: ControlActionSchema }
);
