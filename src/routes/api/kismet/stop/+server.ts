import { json } from '@sveltejs/kit';

import { errMsg } from '$lib/server/api/error-utils';
import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

/** Find running Kismet PIDs. Returns empty array if none found. */
async function findKismetPids(): Promise<string[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout
			.trim()
			.split('\n')
			.filter((p) => p.length > 0);
	} catch {
		return [];
	}
}

/** Check if Kismet is still running. */
async function isKismetRunning(): Promise<boolean> {
	return (await findKismetPids()).length > 0;
}

/** Gracefully terminate Kismet, escalating to SIGKILL if needed. */
async function terminateKismet(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet']);
		logger.info('Sent SIGTERM to Kismet processes');
		await new Promise((resolve) => setTimeout(resolve, 2000));

		if (await isKismetRunning()) {
			logger.warn('Some Kismet processes still running, sending SIGKILL');
			await execFileAsync('/usr/bin/pkill', ['-KILL', 'kismet']);
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	} catch (error) {
		logger.error('Error during Kismet termination', { error: errMsg(error) });
	}
}

/** Clean up kismon interface if it exists. */
async function cleanupKismonInterface(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['ip', 'link', 'delete', 'kismon0']);
	} catch {
		/* interface might not exist */
	}
}

export const POST: RequestHandler = async () => {
	try {
		logger.info('Stopping Kismet with robust cleanup');
		const pids = await findKismetPids();
		if (pids.length === 0) {
			logger.info('No Kismet processes found');
			return json({ success: true, status: 'stopped', message: 'Kismet was not running' });
		}

		logger.info('Found Kismet processes to terminate', { pids: pids.join(', ') });
		await terminateKismet();
		await cleanupKismonInterface();

		if (await isKismetRunning()) {
			logger.error('Kismet processes may still be running');
			return json(
				{ success: false, status: 'error', message: 'Failed to stop all Kismet processes' },
				{ status: 500 }
			);
		}

		logger.info('Verification passed: No Kismet processes found');
		return json({
			success: true,
			status: 'stopped',
			message: 'Kismet WiFi discovery stopped successfully'
		});
	} catch (error) {
		logger.error('Kismet stop error', { error: errMsg(error) });
		return json(
			{ success: false, error: errMsg(error), message: 'Failed to stop Kismet' },
			{ status: 500 }
		);
	}
};
