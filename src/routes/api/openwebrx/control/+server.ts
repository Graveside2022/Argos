import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

const COMPOSE_FILE = '/home/kali/Documents/Argos/Argos/docker/docker-compose.portainer-dev.yml';
const CONTAINER_NAME = 'openwebrx-hackrf';
const SERVICE_NAME = 'openwebrx';

/**
 * POST /api/openwebrx/control
 * Control OpenWebRX Docker container
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action } = body;

		if (!action || !['start', 'stop', 'restart', 'status'].includes(action)) {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}

		if (action === 'status') {
			// Check if container is running
			try {
				const { stdout } = await execAsync(
					`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.State}}"`
				);
				const running = stdout.trim() === 'running';

				return json({
					success: true,
					running,
					status: running ? 'running' : 'stopped'
				});
			} catch {
				return json({
					success: true,
					running: false,
					status: 'stopped'
				});
			}
		}

		if (action === 'start') {
			// Start container with tools profile
			await execAsync(
				`docker compose -f ${COMPOSE_FILE} --profile tools up -d ${SERVICE_NAME}`
			);

			// Wait for container to be ready
			await new Promise((resolve) => setTimeout(resolve, 2000));

			return json({
				success: true,
				action: 'start',
				message: 'OpenWebRX started successfully',
				url: 'http://localhost:8073'
			});
		}

		if (action === 'stop') {
			// Stop container
			await execAsync(`docker compose -f ${COMPOSE_FILE} stop ${SERVICE_NAME}`);

			return json({
				success: true,
				action: 'stop',
				message: 'OpenWebRX stopped successfully'
			});
		}

		if (action === 'restart') {
			// Restart container
			await execAsync(`docker compose -f ${COMPOSE_FILE} restart ${SERVICE_NAME}`);

			return json({
				success: true,
				action: 'restart',
				message: 'OpenWebRX restarted successfully'
			});
		}

		return json({ success: false, error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error('OpenWebRX control error:', msg);

		return json(
			{
				success: false,
				error: `Failed to control OpenWebRX: ${msg}`
			},
			{ status: 500 }
		);
	}
};
