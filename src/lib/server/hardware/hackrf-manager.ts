import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Native binaries — their /proc/PID/comm matches the binary name, so -x (exact) is safe */
const HACKRF_NATIVE_PROCESSES = [
	'hackrf_sweep',
	'hackrf_transfer',
	'hackrf_info',
	'soapy_connector',
	'btle_rx',
	'urh',
	'TempestSDR',
	'multimon-ng'
];

/** Python-wrapped tools — their /proc/PID/comm is "python3", so we need -f (cmdline match) */
const HACKRF_PYTHON_PROCESSES = ['grgsm_livemon', 'grgsm_livemon_headless'];

/** Map raw process names to user-friendly tool names for the status bar */
const PROCESS_DISPLAY_NAMES: Record<string, string> = {
	grgsm_livemon: 'GSM Evil',
	grgsm_livemon_headless: 'GSM Evil',
	hackrf_sweep: 'Spectrum Sweep',
	soapy_connector: 'OpenWebRX',
	btle_rx: 'BLE Scanner'
};

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
	const blocking: { pid: string; name: string }[] = [];

	// Native binaries: use -x (exact comm match) — safe, no false positives
	for (const proc of HACKRF_NATIVE_PROCESSES) {
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', proc]);
			const pids = stdout.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				blocking.push({ pid, name: PROCESS_DISPLAY_NAMES[proc] ?? proc });
			}
		} catch (_error: unknown) {
			// Process not found
		}
	}

	// Python-wrapped tools: use -f (full cmdline match) because their comm is "python3"
	for (const proc of HACKRF_PYTHON_PROCESSES) {
		try {
			const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-f', proc]);
			const pids = stdout.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				blocking.push({ pid, name: PROCESS_DISPLAY_NAMES[proc] ?? proc });
			}
		} catch (_error: unknown) {
			// Process not found
		}
	}

	return blocking;
}

/** SIGKILL-s all native and Python processes holding the HackRF, then waits for USB device release. */
export async function killBlockingProcesses(): Promise<void> {
	// Native binaries: exact comm match
	for (const proc of HACKRF_NATIVE_PROCESSES) {
		try {
			await execFileAsync('/usr/bin/pkill', ['-9', '-x', proc]);
		} catch (_error: unknown) {
			// Process not found or already dead
		}
	}
	// Python-wrapped tools: full cmdline match
	for (const proc of HACKRF_PYTHON_PROCESSES) {
		try {
			await execFileAsync('/usr/bin/pkill', ['-9', '-f', proc]);
		} catch (_error: unknown) {
			// Process not found or already dead
		}
	}
	// Wait for USB device release
	await new Promise((resolve) => setTimeout(resolve, 2000));
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
