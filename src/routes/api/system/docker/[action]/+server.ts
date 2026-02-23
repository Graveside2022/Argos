import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

/** Containers that may be managed via this endpoint */
const VALID_CONTAINERS = ['openwebrx-hackrf', 'bettercap'];

/** Extract error message from an unknown error value */
function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** Derive the compose service name from a container name */
function toServiceName(container: string): string {
	return container.replace('-hackrf', '');
}

/** Resolve the compose file path for Argos tools */
function composeFilePath(): string {
	return path.join(process.cwd(), 'docker/docker-compose.portainer-dev.yml');
}

/** Build docker compose args for starting a service */
function startArgs(composeFile: string, service: string): string[] {
	return ['compose', '-f', composeFile, '--profile', 'tools', 'up', '-d', service];
}

/** Build docker compose args for stopping a service */
function stopArgs(composeFile: string, service: string): string[] {
	return ['compose', '-f', composeFile, 'stop', service];
}

/** Build docker compose args for restarting a service */
function restartArgs(composeFile: string, service: string): string[] {
	return ['compose', '-f', composeFile, 'restart', service];
}

/** Execute a docker compose action and return a success response */
async function executeAction(action: string, container: string): Promise<Response> {
	const composeFile = composeFilePath();
	const service = toServiceName(container);

	const argsMap: Record<string, string[]> = {
		start: startArgs(composeFile, service),
		stop: stopArgs(composeFile, service),
		restart: restartArgs(composeFile, service)
	};

	const args = argsMap[action];
	if (!args) {
		return json({ success: false, error: 'Invalid action' }, { status: 400 });
	}

	await execFileAsync('/usr/bin/docker', args);

	if (action === 'start') {
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	return json({
		success: true,
		action,
		container,
		message: `${container} ${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'} successfully`
	});
}

/**
 * POST /api/system/docker/[action]
 * Start or stop Docker containers for tools
 *
 * Actions: start, stop, restart
 * Body: { container: string } (e.g., "openwebrx-hackrf", "bettercap")
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const { action } = params;
	const body = await request.json();
	const { container } = body;

	if (!container || typeof container !== 'string') {
		return json({ success: false, error: 'Container name required' }, { status: 400 });
	}

	if (!VALID_CONTAINERS.includes(container)) {
		return json({ success: false, error: 'Invalid container name' }, { status: 400 });
	}

	try {
		return await executeAction(action, container);
	} catch (error) {
		const msg = errMsg(error);
		logger.error('Docker action error', { action, container, error: msg });

		return json(
			{
				success: false,
				error: `Failed to ${action} ${container}: ${msg}`
			},
			{ status: 500 }
		);
	}
};
