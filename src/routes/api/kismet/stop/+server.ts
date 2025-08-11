import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
	try {
		console.log('Stopping Kismet with robust cleanup...');

		// First try to get Kismet PIDs
		let pids: string[] = [];
		try {
			const { stdout } = await execAsync('pgrep -x kismet');
			pids = stdout
				.trim()
				.split('\n')
				.filter((pid) => pid.length > 0);

			if (pids.length > 0) {
				console.log('Found Kismet processes to terminate:', pids.join(', '));
			}
		} catch {
			// No Kismet processes found
			console.log('No Kismet processes found');
			return json({
				success: true,
				status: 'stopped',
				message: 'Kismet was not running'
			});
		}

		// Send SIGTERM to all Kismet processes (graceful shutdown)
		if (pids.length > 0) {
			try {
				await execAsync('pkill -TERM kismet');
				console.log('Sent SIGTERM to Kismet processes');

				// Give Kismet time to cleanup gracefully
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check if any processes are still running
				try {
					await execAsync('pgrep -x kismet');
					// If we get here, some processes are still running, force kill them
					console.log('Some Kismet processes still running, sending SIGKILL...');
					await execAsync('pkill -KILL kismet');
					await new Promise((resolve) => setTimeout(resolve, 1000));
				} catch {
					// Good - no processes remaining
				}
			} catch (error) {
				console.error('Error during Kismet termination:', error);
			}
		}

		// Also kill any kismon interfaces that might be lingering
		try {
			await execAsync('sudo ip link delete kismon0 2>/dev/null || true');
		} catch {
			// Ignore errors - interface might not exist
		}

		// Final verification
		try {
			await execAsync('pgrep -x kismet');
			// If we get here, Kismet is still running somehow
			console.error('Warning: Kismet processes may still be running');
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
		} catch {
			// Good - no Kismet processes found
			console.log('Verification passed: No Kismet processes found');
		}

		return json({
			success: true,
			status: 'stopped',
			message: 'Kismet WiFi discovery stopped successfully'
		});
	} catch (error) {
		console.error('Kismet stop error:', error);

		return json(
			{
				success: false,
				error: (error as Error).message,
				message: 'Failed to stop Kismet'
			},
			{
				status: 500
			}
		);
	}
};
