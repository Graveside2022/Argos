import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const CONTAINER_NAME = 'openwebrx-hackrf';

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

/** Execute a docker lifecycle command and return success response. */
async function dockerLifecycle(
	action: string,
	message: string,
	extra?: Record<string, unknown>
): Promise<Response> {
	await execFileAsync('docker', [action, CONTAINER_NAME]);
	if (action === 'start') await new Promise((resolve) => setTimeout(resolve, 2000));
	return json({ success: true, action, message, ...extra });
}

const VALID_ACTIONS = new Set(['start', 'stop', 'restart', 'status']);

const LIFECYCLE_EXTRAS: Record<string, Record<string, unknown> | undefined> = {
	start: { url: env.OPENWEBRX_URL }
};

/** Execute validated OpenWebRX action. */
function executeAction(action: string): Promise<Response> {
	if (action === 'status') return getContainerStatus();
	return dockerLifecycle(action, `OpenWebRX ${action}ed successfully`, LIFECYCLE_EXTRAS[action]);
}

/**
 * POST /api/openwebrx/control
 * Control OpenWebRX Docker container
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action } = await request.json();
		if (!action || !VALID_ACTIONS.has(action)) {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
		return executeAction(action);
	} catch (err) {
		logger.error('OpenWebRX control error', { error: errMsg(err) });
		return json(
			{ success: false, error: `Failed to control OpenWebRX: ${errMsg(err)}` },
			{ status: 500 }
		);
	}
};
