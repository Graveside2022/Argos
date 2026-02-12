import { json } from '@sveltejs/kit';

import { hostExec } from '$lib/server/host-exec';
import { logWarn } from '$lib/utils/logger';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
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
			const { stdout: grgsmCheck } = await hostExec(
				'ps aux | grep -E "grgsm_livemon_headless" | grep -v grep | grep -v "timeout" | head -1'
			);
			if (grgsmCheck.trim()) {
				const parts = grgsmCheck.trim().split(/\s+/);
				const pid = parseInt(parts[1]);
				if (!isNaN(pid)) {
					// Check if this is a long-running process (not a scan)
					try {
						const { stdout: pidTime } = await hostExec(
							`ps -o etimes= -p ${pid} 2>/dev/null || echo 0`
						);
						const runtime = parseInt(pidTime.trim()) || 0;
						// Only consider it "running" if it's been up for more than 10 seconds
						if (runtime > 10) {
							status.grgsm.running = true;
							status.grgsm.pid = pid;
						}
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : String(error);
						logWarn(
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
			const { stdout: gsmevilCheck } = await hostExec(
				'ps aux | grep -E "python3? GsmEvil(_auto)?\\.py" | grep -v grep | head -1'
			);
			if (gsmevilCheck.trim()) {
				const parts = gsmevilCheck.trim().split(/\s+/);
				const pid = parseInt(parts[1]);
				if (!isNaN(pid)) {
					status.gsmevil.running = true;
					status.gsmevil.pid = pid;

					// Check if web interface is accessible
					try {
						const { stdout: curlCheck } = await hostExec(
							'timeout 1 curl -s -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000"'
						);
						status.gsmevil.webInterface = curlCheck.trim() === '200';
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
		console.error('Status check error:', error);
		return json(
			{
				status: 'error',
				message: 'Failed to check GSM Evil status',
				error: (error as Error).message
			},
			{ status: 500 }
		);
	}
};
