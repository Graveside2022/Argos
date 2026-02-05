import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
	try {
		// Check if rtl_433 process is running (more reliable check)
		const { stdout } = await execAsync('ps aux | grep "[r]tl_433" | grep -v grep || echo ""');
		const lines = stdout
			.trim()
			.split('\n')
			.filter((line) => line && line.length > 0);

		// Extract PID from ps output
		let actualRtlProcess = null;
		if (lines.length > 0) {
			const pid = lines[0].trim().split(/\s+/)[1];
			if (pid && /^\d+$/.test(pid)) {
				actualRtlProcess = pid;
			}
		}

		return json({
			status: actualRtlProcess ? 'running' : 'stopped',
			pid: actualRtlProcess,
			timestamp: new Date().toISOString()
		});
	} catch (_error) {
		// pgrep returns exit code 1 if no process is found
		return json({
			status: 'stopped',
			pid: null,
			timestamp: new Date().toISOString()
		});
	}
};
