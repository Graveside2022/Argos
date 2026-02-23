import { execFile } from 'child_process';
import { promisify } from 'util';

import type { ProcessConfig } from './process-utils';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const execFileAsync = promisify(execFile);

/** HackRF process configs for shared process detection/kill utilities */
const HACKRF_PROCESS_CONFIGS: ProcessConfig[] = [
	// Native binaries: -x (exact comm match)
	{ name: 'hackrf_sweep', displayName: 'Spectrum Sweep' },
	{ name: 'hackrf_transfer' },
	{ name: 'hackrf_info' },
	{ name: 'soapy_connector', displayName: 'OpenWebRX' },
	{ name: 'btle_rx', displayName: 'BLE Scanner' },
	{ name: 'urh' },
	{ name: 'TempestSDR' },
	{ name: 'multimon-ng' },
	// Python-wrapped tools: -f (full cmdline match) because their comm is "python3"
	{ name: 'grgsm_livemon', displayName: 'GSM Evil', useCmdlineMatch: true },
	{ name: 'grgsm_livemon_headless', displayName: 'GSM Evil', useCmdlineMatch: true }
];

// Tool containers that actively use HackRF (ownership candidates)
const HACKRF_TOOL_CONTAINERS = ['openwebrx', 'openwebrx-hackrf', 'pagermon'];

// All containers that may hold the HackRF USB device (for force-release cleanup)
const HACKRF_ALL_CONTAINERS = ['openwebrx', 'openwebrx-hackrf', 'pagermon'];

/** Detects whether a HackRF device is physically connected, falling back to lsusb if hackrf_info fails. */
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

/** Returns running native and Python processes (hackrf_sweep, grgsm_livemon, etc.) that hold the HackRF device. */
export async function getBlockingProcesses(): Promise<{ pid: string; name: string }[]> {
	return findBlockingProcesses(HACKRF_PROCESS_CONFIGS);
}

/** SIGKILL-s all native and Python processes holding the HackRF, then waits for USB device release. */
export async function killBlockingProcesses(): Promise<void> {
	return killMatchingProcesses(HACKRF_PROCESS_CONFIGS);
}

/**
 * Checks Docker container running status for HackRF-related tools.
 * @param toolOnly If true, only checks tool containers (openwebrx, pagermon); otherwise checks all.
 */
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

/** Stops all Docker containers that may hold the HackRF USB device, then waits for release. */
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
