import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const HACKRF_BLOCKING_PROCESSES = [
	'hackrf_sweep',
	'hackrf_transfer',
	'hackrf_info',
	'grgsm_livemon',
	'soapy_connector',
	'btle_rx',
	'urh',
	'TempestSDR',
	'multimon-ng'
];

// Tool containers that actively use HackRF (ownership candidates)
const HACKRF_TOOL_CONTAINERS = ['openwebrx', 'openwebrx-hackrf', 'pagermon'];

// All containers that may hold the HackRF USB device (for force-release cleanup)
const HACKRF_ALL_CONTAINERS = [
	'openwebrx',
	'openwebrx-hackrf',
	'pagermon',
	'hackrf-backend-dev',
	'hackrf-backend'
];

export async function detectHackRF(): Promise<boolean> {
	try {
		const { stdout } = await execAsync('timeout 3 hackrf_info 2>&1');
		return stdout.includes('Serial number');
	} catch (_error: unknown) {
		// hackrf_info fails when device is busy (held by another process/container)
		// Fall back to lsusb check for HackRF USB VID:PID
		try {
			const { stdout } = await execAsync('lsusb 2>/dev/null');
			return stdout.includes('1d50:6089');
		} catch (_error: unknown) {
			return false;
		}
	}
}

export async function getBlockingProcesses(): Promise<{ pid: string; name: string }[]> {
	const blocking: { pid: string; name: string }[] = [];

	for (const proc of HACKRF_BLOCKING_PROCESSES) {
		try {
			const { stdout } = await execAsync(`pgrep -x "${proc}" 2>/dev/null`);
			const pids = stdout.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				blocking.push({ pid, name: proc });
			}
		} catch (_error: unknown) {
			// Process not found
		}
	}

	return blocking;
}

export async function killBlockingProcesses(): Promise<void> {
	for (const proc of HACKRF_BLOCKING_PROCESSES) {
		try {
			await execAsync(`pkill -9 -x "${proc}" 2>/dev/null`);
		} catch (_error: unknown) {
			// Process not found or already dead
		}
	}
	// Wait for USB device release
	await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function getContainerStatus(
	toolOnly = false
): Promise<{ name: string; running: boolean }[]> {
	const results: { name: string; running: boolean }[] = [];
	const containers = toolOnly ? HACKRF_TOOL_CONTAINERS : HACKRF_ALL_CONTAINERS;

	for (const container of containers) {
		try {
			const { stdout } = await execAsync(
				`docker ps --filter "name=${container}" --format "{{.Names}}" 2>/dev/null`
			);
			// Use exact name matching (docker filter does substring match)
			const names = stdout.trim().split('\n').filter(Boolean);
			const exactMatch = names.some((n) => n === container);
			results.push({ name: container, running: exactMatch });
		} catch (_error: unknown) {
			results.push({ name: container, running: false });
		}
	}

	return results;
}

export async function stopContainers(): Promise<void> {
	for (const container of HACKRF_ALL_CONTAINERS) {
		try {
			await execAsync(`docker stop "${container}" 2>/dev/null`);
		} catch (_error: unknown) {
			// Container not running or doesn't exist
		}
	}
	await new Promise((resolve) => setTimeout(resolve, 3000));
}
