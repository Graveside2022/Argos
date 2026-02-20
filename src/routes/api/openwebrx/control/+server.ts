import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

const CONTAINER_NAME = 'openwebrx-hackrf';

/**
 * POST /api/openwebrx/control
 * Control OpenWebRX Docker container
 * Body: { action: 'start' | 'stop' | 'restart' | 'status' }
 *
 * Uses plain docker commands for direct container management.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action } = body;

		if (!action || !['start', 'stop', 'restart', 'status'].includes(action)) {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}

		if (action === 'status') {
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
			await execFileAsync('docker', ['start', CONTAINER_NAME]);

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
			await execFileAsync('docker', ['stop', CONTAINER_NAME]);

			return json({
				success: true,
				action: 'stop',
				message: 'OpenWebRX stopped successfully'
			});
		}

		if (action === 'restart') {
			await execFileAsync('docker', ['restart', CONTAINER_NAME]);

			return json({
				success: true,
				action: 'restart',
				message: 'OpenWebRX restarted successfully'
			});
		}

		return json({ success: false, error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.error('OpenWebRX control error', { error: msg });

		return json(
			{
				success: false,
				error: `Failed to control OpenWebRX: ${msg}`
			},
			{ status: 500 }
		);
	}
};
