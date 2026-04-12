import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createHandler } from '$lib/server/api/create-handler';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';

const CONTAINER_NAME = 'novasdr-hackrf';
const PEER_CONTAINER = 'openwebrx-hackrf';

const ControlActionSchema = z.object({
	action: z.enum(['start', 'stop', 'restart', 'status'])
});
type ControlBody = z.infer<typeof ControlActionSchema>;
type ControlAction = ControlBody['action'];

/** Check container running status. */
async function getContainerStatus(): Promise<Response> {
	try {
		const { stdout } = await execFileAsync('docker', [
			'ps',
			'--filter',
			`name=${CONTAINER_NAME}`,
			'--format',
			'{{.State}}'
		]);
		const running = stdout.trim() === 'running';
		return json({ success: true, running, status: running ? 'running' : 'stopped' });
	} catch {
		return json({ success: true, running: false, status: 'stopped' });
	}
}

/** Soft interlock: best-effort stop of the peer WebSDR to release the HackRF. */
async function stopPeerIfRunning(): Promise<void> {
	try {
		await execFileAsync('docker', ['stop', PEER_CONTAINER]);
	} catch {
		// Peer is already stopped or not present — ignore.
	}
}

/** Execute a docker lifecycle command and return success response. */
async function dockerLifecycle(
	action: string,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	if (action === 'start') await stopPeerIfRunning();
	await execFileAsync('docker', [action, CONTAINER_NAME]);
	if (action === 'start') await delay(2000);
	return json({ success: true, action, message, ...extra });
}

const LIFECYCLE_EXTRAS: Record<ControlAction, Record<string, unknown> | undefined> = {
	start: { url: env.NOVASDR_URL },
	stop: undefined,
	restart: undefined,
	status: undefined
};

const LIFECYCLE_MESSAGES: Record<Exclude<ControlAction, 'status'>, string> = {
	start: 'NovaSDR started successfully',
	stop: 'NovaSDR stopped successfully',
	restart: 'NovaSDR restarted successfully'
};

/** Execute validated NovaSDR action. */
function executeAction(action: ControlAction): Promise<Response> {
	if (action === 'status') return getContainerStatus();
	return dockerLifecycle(action, LIFECYCLE_MESSAGES[action], LIFECYCLE_EXTRAS[action]);
}

/**
 * POST /api/novasdr/control
 * Control NovaSDR Docker container. Shares a HackRF with OpenWebRX — starting
 * NovaSDR issues a best-effort stop of openwebrx-hackrf first (soft interlock).
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST = createHandler(
	async ({ request }) => {
		const { action } = (await request.json()) as ControlBody;
		return executeAction(action);
	},
	{ validateBody: ControlActionSchema }
);
