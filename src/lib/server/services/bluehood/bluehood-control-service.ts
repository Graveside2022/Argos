/**
 * BlueHood Bluetooth scanner control service.
 * Manages start/stop/status of the BlueHood systemd service.
 *
 * BlueHood uses the system Bluetooth adapter (hci0) from the Alfa AWUS036AXML
 * (MT7961 combo). Kismet also uses hci0 for BLE scanning — they cannot run
 * simultaneously on the same adapter. This service enforces mutual exclusion.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

export interface BluehoodControlResult {
	success: boolean;
	message: string;
	details?: string;
	error?: string;
}

export interface BluehoodStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
	port: number;
}

const BLUEHOOD_PORT = env.BLUEHOOD_PORT;
const BLUEHOOD_HEALTH_URL = `http://localhost:${BLUEHOOD_PORT}`;

/** Check if the BlueHood systemd service is active */
async function isBluehoodServiceActive(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/systemctl', ['is-active', 'bluehood']);
		return stdout.trim() === 'active';
	} catch {
		return false;
	}
}

/** Check if the BlueHood web dashboard is responding */
async function isBluehoodApiResponding(): Promise<boolean> {
	try {
		const response = await fetch(BLUEHOOD_HEALTH_URL, {
			signal: AbortSignal.timeout(2000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

/** Check if Kismet is currently running (uses same hci0 adapter) */
async function isKismetRunning(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
}

/** Stop Kismet gracefully so BlueHood can claim hci0 */
async function stopKismetForBluetooth(): Promise<void> {
	logger.info('[bluehood] Stopping Kismet to release Bluetooth adapter');
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'kismet']);
	} catch {
		/* service may not be running as systemd unit */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-x', 'kismet']);
	} catch {
		/* no process to kill */
	}
	await delay(2000);
}

/** Poll BlueHood dashboard until it responds or timeout */
async function waitForBluehoodReady(maxAttempts = 15): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isBluehoodApiResponding()) return true;
		await delay(1000);
	}
	return false;
}

/** Enforce mutual exclusion — stop Kismet if it holds hci0. Returns error result or null. */
async function ensureBluetoothAdapterFree(): Promise<BluehoodControlResult | null> {
	if (!(await isKismetRunning())) return null;

	logger.info('[bluehood] Kismet is running — stopping it to release Bluetooth adapter');
	await stopKismetForBluetooth();

	if (await isKismetRunning()) {
		return {
			success: false,
			message: 'Could not stop Kismet to release the Bluetooth adapter',
			error: 'Kismet is still running. Stop Kismet manually before starting BlueHood.'
		};
	}
	logger.info('[bluehood] Kismet stopped, Bluetooth adapter released');
	return null;
}

/** Resolve start result after systemd start command has been issued. */
async function resolveStartResult(): Promise<BluehoodControlResult> {
	if (await waitForBluehoodReady()) {
		logger.info('[bluehood] Started successfully');
		return {
			success: true,
			message: 'BlueHood started successfully',
			details: `BLE scanner active — dashboard at http://localhost:${BLUEHOOD_PORT}`
		};
	}
	if (await isBluehoodServiceActive()) {
		return {
			success: true,
			message: 'BlueHood is starting, dashboard may take a few more seconds',
			details: `Check http://localhost:${BLUEHOOD_PORT}`
		};
	}
	logger.error('[bluehood] Failed to start — check journalctl -u bluehood');
	return {
		success: false,
		message: 'BlueHood failed to start',
		error: 'Service did not become active. Check: journalctl -u bluehood -n 50'
	};
}

/** Start the BlueHood Bluetooth scanner service */
export async function startBluehood(): Promise<BluehoodControlResult> {
	try {
		logger.info('[bluehood] Starting BlueHood');

		if (await isBluehoodServiceActive()) {
			logger.info('[bluehood] Already running');
			return {
				success: true,
				message: 'BlueHood is already running',
				details: `Dashboard at http://localhost:${BLUEHOOD_PORT}`
			};
		}

		const conflictError = await ensureBluetoothAdapterFree();
		if (conflictError) return conflictError;

		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'start', 'bluehood']);
		logger.info('[bluehood] Service start command issued, waiting for dashboard...');

		return resolveStartResult();
	} catch (error: unknown) {
		logger.error('[bluehood] Start error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to start BlueHood',
			error: errMsg(error)
		};
	}
}

/** Stop the BlueHood Bluetooth scanner service */
export async function stopBluehood(): Promise<BluehoodControlResult> {
	try {
		logger.info('[bluehood] Stopping BlueHood');

		if (!(await isBluehoodServiceActive())) {
			return {
				success: true,
				message: 'BlueHood stopped successfully',
				details: 'No service was running'
			};
		}

		await execFileAsync('/usr/bin/sudo', ['/usr/bin/systemctl', 'stop', 'bluehood']);
		await delay(2000);

		if (await isBluehoodServiceActive()) {
			return {
				success: false,
				message: 'BlueHood stop attempted but service is still active',
				error: 'systemctl stop bluehood did not terminate the service'
			};
		}

		logger.info('[bluehood] Stopped successfully');
		return {
			success: true,
			message: 'BlueHood stopped successfully',
			details: 'Service stopped and Bluetooth adapter released'
		};
	} catch (error: unknown) {
		logger.error('[bluehood] Stop error', { error: errMsg(error) });
		return {
			success: false,
			message: 'Failed to stop BlueHood',
			error: errMsg(error)
		};
	}
}

/** Get current BlueHood service status */
export async function getBluehoodStatus(): Promise<BluehoodStatusResult> {
	try {
		const serviceActive = await isBluehoodServiceActive();
		const apiResponding = await isBluehoodApiResponding();
		const isRunning = serviceActive || apiResponding;
		return {
			success: true,
			isRunning,
			status: isRunning ? 'active' : 'inactive',
			port: BLUEHOOD_PORT
		};
	} catch {
		return {
			success: true,
			isRunning: false,
			status: 'inactive',
			port: BLUEHOOD_PORT
		};
	}
}
