import { json } from '@sveltejs/kit';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

const execFileAsync = promisify(execFile);

export const GET: RequestHandler = async () => {
	try {
		// Safe: Status properties initialized as null, explicitly typed for union types (number|null, string|null)
		const status = {
			grgsm: {
				running: false,
				pid: null as number | null,
				frequency: '948.6 MHz'
			},
			gsmevil: {
				running: false,
				pid: null as number | null,
				webInterface: false
			},
			dataCollection: {
				active: false,
				lastActivity: null as string | null,
				packetsReceived: 0
			}
		};

		// Check gr-gsm_livemon (without --collector flag) - but exclude temporary scan processes
		try {
			// Look for grgsm_livemon_headless but exclude ones that are part of scanning (they run briefly)
			// GSM Evil proper runs with specific long-running parameters
			const { stdout: grgsmCheck } = await execFileAsync('/usr/bin/pgrep', [
				'-af',
				'grgsm_livemon_headless'
			]);
			// Filter out "timeout" matches and take first line (equivalent to grep -v "timeout" | head -1)
			const grgsmLine = grgsmCheck
				.split('\n')
				.filter((line) => line.trim() && !line.includes('timeout'))
				.at(0);
			if (grgsmLine) {
				// pgrep -af output format: "PID command..."
				const parts = grgsmLine.trim().split(/\s+/);
				const pid = parseInt(parts[0]);
				if (!isNaN(pid)) {
					// Check if this is a long-running process (not a scan)
					try {
						const validPid = validateNumericParam(pid, 'pid', 1, 4194304);
						const { stdout: pidTime } = await execFileAsync('/usr/bin/ps', [
							'-o',
							'etimes=',
							'-p',
							String(validPid)
						]);
						const runtime = parseInt(pidTime.trim()) || 0;
						// Only consider it "running" if it's been up for more than 10 seconds
						if (runtime > 10) {
							status.grgsm.running = true;
							status.grgsm.pid = validPid;
						}
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						logger.warn(
							'[GSM-Evil] Runtime check failed for PID',
							{ error: msg, pid },
							'gsm-runtime-check'
						);
					}
				}
			}
		} catch (_error: unknown) {
			// grgsm process check - expected to fail when not running
		}

		// Check GSMEvil2 with exact match (including auto version)
		try {
			const { stdout: gsmevilCheck } = await execFileAsync('/usr/bin/pgrep', [
				'-af',
				'GsmEvil.*\\.py'
			]);
			// Take first matching line (equivalent to head -1)
			const gsmevilLine = gsmevilCheck
				.split('\n')
				.filter((line) => line.trim())
				.at(0);
			if (gsmevilLine) {
				// pgrep -af output format: "PID command..."
				const parts = gsmevilLine.trim().split(/\s+/);
				const pid = parseInt(parts[0]);
				if (!isNaN(pid)) {
					status.gsmevil.running = true;
					status.gsmevil.pid = pid;

					// Check if web interface is accessible
					try {
						const response = await fetch('http://localhost:8080', {
							signal: AbortSignal.timeout(1000)
						});
						status.gsmevil.webInterface = response.status === 200;
					} catch (_error: unknown) {
						status.gsmevil.webInterface = false;
					}
				}
			}
		} catch (_error: unknown) {
			// gsmevil process check - expected to fail when not running
		}

		// If both are running, assume data collection is active
		if (status.grgsm.running && status.gsmevil.running) {
			status.dataCollection.active = true;
			status.dataCollection.lastActivity = 'Active';
		}

		// Determine overall status
		const overallStatus =
			status.grgsm.running && status.gsmevil.running ? 'running' : 'stopped';

		return json({
			status: overallStatus,
			details: status,
			message:
				overallStatus === 'running'
					? 'GSM Evil is running and monitoring'
					: 'GSM Evil is stopped'
		});
	} catch (error: unknown) {
		logger.error('Status check error', { error: (error as Error).message });
		return json(
			{
				status: 'error',
				message: 'Failed to check GSM Evil status',
				// Safe: Catch block error cast to Error for message extraction in error response
				// Safe: Catch block error cast to Error for message extraction
				error: (error as Error).message
			},
			{ status: 500 }
		);
	}
};
