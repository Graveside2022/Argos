/**
 * Sparrow-WiFi agent control service.
 * Manages start/stop/status of the sparrow-wifi-agent systemd service.
 *
 * Sparrow uses WiFi adapters (not hci0), so no mutual exclusion with
 * BlueHood/Kismet is needed for WiFi scanning. Sparrow's own BT scanning
 * uses hci0 but is optional and user-triggered from the dashboard.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import type { SparrowControlResult, SparrowStatusResult } from '$lib/types/sparrow';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

const SPARROW_PORT = env.SPARROW_PORT;
const SPARROW_HEALTH_URL = `http://localhost:${SPARROW_PORT}/wireless/interfaces`;

/** Check if the sparrow-wifi-agent systemd service is active */
async function isSparrowServiceActive(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/systemctl', [
			'is-active',
			'sparrow-wifi-agent'
		]);
		return stdout.trim() === 'active';
	} catch {
		return false;
	}
}

/** Check if the Sparrow agent HTTP API is responding */
async function isSparrowApiResponding(): Promise<boolean> {
	try {
		const response = await fetch(SPARROW_HEALTH_URL, {
			signal: AbortSignal.timeout(2000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

/** Poll Sparrow agent until it responds or timeout */
async function waitForSparrowReady(maxAttempts = 15): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isSparrowApiResponding()) return true;
		await delay(1000);
	}
	return false;
}

/** Resolve start result after systemd start command has been issued */
async function resolveStartResult(): Promise<SparrowControlResult> {
	if (await waitForSparrowReady()) {
		logger.info('[sparrow] Started successfully');
		return {
			success: true,
			message: 'Sparrow-WiFi agent started successfully',
			details: `REST API active on port ${SPARROW_PORT}`
		};
	}
	if (await isSparrowServiceActive()) {
		return {
			success: true,
			message: 'Sparrow-WiFi agent is starting, API may take a few more seconds',
			details: `Check http://localhost:${SPARROW_PORT}/wireless/interfaces`
		};
	}
	logger.error('[sparrow] Failed to start — check journalctl -u sparrow-wifi-agent');
	return {
		success: false,
		message: 'Sparrow-WiFi agent failed to start',
		error: 'Service did not become active. Check: journalctl -u sparrow-wifi-agent -n 50'
	};
}

/** Start the Sparrow-WiFi agent service */
export async function startSparrow(): Promise<SparrowControlResult> {
	try {
		logger.info('[sparrow] Starting Sparrow-WiFi agent');

		if (await isSparrowServiceActive()) {
			logger.info('[sparrow] Already running');
			return {
				success: true,
				message: 'Sparrow-WiFi agent is already running',
				details: `REST API on port ${SPARROW_PORT}`
			};
		}

		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'start', 'sparrow-wifi-agent']);
		logger.info('[sparrow] Service start command issued, waiting for API...');

		return resolveStartResult();
	} catch (error: unknown) {
		logger.error('[sparrow] Start error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to start Sparrow-WiFi agent',
			error: errMsg(error)
		};
	}
}

/** Stop the Sparrow-WiFi agent service */
export async function stopSparrow(): Promise<SparrowControlResult> {
	try {
		logger.info('[sparrow] Stopping Sparrow-WiFi agent');

		if (!(await isSparrowServiceActive())) {
			return {
				success: true,
				message: 'Sparrow-WiFi agent stopped successfully',
				details: 'No service was running'
			};
		}

		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'sparrow-wifi-agent']);
		await delay(2000);

		if (await isSparrowServiceActive()) {
			return {
				success: false,
				message: 'Sparrow-WiFi agent stop attempted but service is still active',
				error: 'systemctl stop sparrow-wifi-agent did not terminate the service'
			};
		}

		logger.info('[sparrow] Stopped successfully');
		return {
			success: true,
			message: 'Sparrow-WiFi agent stopped successfully',
			details: 'Service stopped and WiFi adapter released'
		};
	} catch (error: unknown) {
		logger.error('[sparrow] Stop error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to stop Sparrow-WiFi agent',
			error: errMsg(error)
		};
	}
}

/** Get current Sparrow-WiFi agent service status */
export async function getSparrowStatus(): Promise<SparrowStatusResult> {
	try {
		const serviceActive = await isSparrowServiceActive();
		const apiResponding = await isSparrowApiResponding();
		const isRunning = serviceActive || apiResponding;
		return {
			success: true,
			isRunning,
			status: isRunning ? 'active' : 'inactive',
			port: SPARROW_PORT
		};
	} catch {
		return {
			success: true,
			isRunning: false,
			status: 'inactive',
			port: SPARROW_PORT
		};
	}
}
