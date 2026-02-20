import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
const HACKRF_ALL_CONTAINERS = ['openwebrx', 'openwebrx-hackrf', 'pagermon'];

export async function detectHackRF(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/hackrf_info', [], { timeout: 3000 });
		return stdout.includes('Serial number');
	} catch (_error: unknown) {
		// hackrf_info fails when device is busy (held by another process/container)
		// Fall back to lsusb check for HackRF USB VID:PID
		try {
			const { stdout } = await execFileAsync('/usr/bin/lsusb', []);
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
			const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', proc]);
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
			await execFileAsync('/usr/bin/pkill', ['-9', '-x', proc]);
		} catch (_error: unknown) {
			// Process not found or already dead
		}
	}
	// Wait for USB device release
	await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function getContainerStatus(
	toolOnly = false
): Promise<{ name: string; isRunning: boolean }[]> {
	const results: { name: string; isRunning: boolean }[] = [];
	const containers = toolOnly ? HACKRF_TOOL_CONTAINERS : HACKRF_ALL_CONTAINERS;

	for (const container of containers) {
		try {
			const { stdout } = await execFileAsync('/usr/bin/docker', [
				'ps',
				'--filter',
				`name=${container}`,
				'--format',
				'{{.Names}}'
			]);
			// Use exact name matching (docker filter does substring match)
			const names = stdout.trim().split('\n').filter(Boolean);
			const exactMatch = names.some((n) => n === container);
			results.push({ name: container, isRunning: exactMatch });
		} catch (_error: unknown) {
			results.push({ name: container, isRunning: false });
		}
	}

	return results;
}

export async function stopContainers(): Promise<void> {
	for (const container of HACKRF_ALL_CONTAINERS) {
		try {
			await execFileAsync('/usr/bin/docker', ['stop', container]);
		} catch (_error: unknown) {
			// Container not running or doesn't exist
		}
	}
	await new Promise((resolve) => setTimeout(resolve, 3000));
}
