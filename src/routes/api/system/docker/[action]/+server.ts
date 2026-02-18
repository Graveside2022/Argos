import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

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

	const validContainers = ['openwebrx-hackrf', 'bettercap'];
	if (!validContainers.includes(container)) {
		return json({ success: false, error: 'Invalid container name' }, { status: 400 });
	}

	try {
		const composeFile = path.join(process.cwd(), 'docker/docker-compose.portainer-dev.yml');
		const service = container.replace('-hackrf', ''); // openwebrx-hackrf → openwebrx

		if (action === 'start') {
			// Start container with tools profile
			await execAsync(`docker compose -f ${composeFile} --profile tools up -d ${service}`);

			// Wait for container to be ready
			await new Promise((resolve) => setTimeout(resolve, 2000));

			return json({
				success: true,
				action: 'start',
				container,
				message: `${container} started successfully`
			});
		} else if (action === 'stop') {
			// Stop container
			await execAsync(`docker compose -f ${composeFile} stop ${service}`);

			return json({
				success: true,
				action: 'stop',
				container,
				message: `${container} stopped successfully`
			});
		} else if (action === 'restart') {
			// Restart container
			await execAsync(`docker compose -f ${composeFile} restart ${service}`);

			return json({
				success: true,
				action: 'restart',
				container,
				message: `${container} restarted successfully`
			});
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error(`Docker ${action} error for ${container}:`, msg);

		return json(
			{
				success: false,
				error: `Failed to ${action} ${container}: ${msg}`
			},
			{ status: 500 }
		);
	}
};
