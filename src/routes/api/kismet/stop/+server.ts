import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const POST: RequestHandler = async () => {
	try {
		logger.info('Stopping Kismet with robust cleanup');

		// First try to get Kismet PIDs
		let pids: string[] = [];
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
			pids = stdout
				.trim()
				.split('\n')
				.filter((pid) => pid.length > 0);

			if (pids.length > 0) {
				logger.info('Found Kismet processes to terminate', { pids: pids.join(', ') });
			}
		} catch (_error: unknown) {
			// No Kismet processes found
			logger.info('No Kismet processes found');
			return json({
				success: true,
				status: 'stopped',
				message: 'Kismet was not running'
			});
		}

		// Send SIGTERM to all Kismet processes (graceful shutdown)
		if (pids.length > 0) {
			try {
				await execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet']);
				logger.info('Sent SIGTERM to Kismet processes');

				// Give Kismet time to cleanup gracefully
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check if any processes are still running
				try {
					await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
					// If we get here, some processes are still running, force kill them
					logger.warn('Some Kismet processes still running, sending SIGKILL');
					await execFileAsync('/usr/bin/pkill', ['-KILL', 'kismet']);
					await new Promise((resolve) => setTimeout(resolve, 1000));
				} catch (_error: unknown) {
					// Good - no processes remaining
				}
			} catch (error) {
				logger.error('Error during Kismet termination', {
					error: (error as Error).message
				});
			}
		}

		// Also kill any kismon interfaces that might be lingering
		try {
			await execFileAsync('/usr/bin/sudo', ['ip', 'link', 'delete', 'kismon0']);
		} catch (_error: unknown) {
			// Ignore errors - interface might not exist
		}

		// Final verification
		try {
			await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
			// If we get here, Kismet is still running somehow
			logger.error('Kismet processes may still be running');
			return json(
				{
					success: false,
					status: 'error',
					message: 'Failed to stop all Kismet processes'
				},
				{
					status: 500
				}
			);
		} catch (_error: unknown) {
			// Good - no Kismet processes found
			logger.info('Verification passed: No Kismet processes found');
		}

		return json({
			success: true,
			status: 'stopped',
			message: 'Kismet WiFi discovery stopped successfully'
		});
	} catch (error) {
		logger.error('Kismet stop error', { error: (error as Error).message });

		return json(
			{
				success: false,
				// Safe: Catch block error cast to Error for message extraction
				error: (error as Error).message,
				message: 'Failed to stop Kismet'
			},
			{
				status: 500
			}
		);
	}
};
