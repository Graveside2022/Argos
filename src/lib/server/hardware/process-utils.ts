/**
 * Shared process detection and cleanup utilities for hardware managers.
 * Used by hackrf-manager.ts and alfa-manager.ts to find/kill blocking processes.
 */

import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';

export interface ProcessEntry {
	pid: string;
	name: string;
}

export interface ProcessConfig {
	/** Process binary name (matched via pgrep -x for exact /proc/PID/comm match) */
	name: string;
	/** User-friendly display name for UI; defaults to name if omitted */
	displayName?: string;
	/** Use -f (full cmdline match) instead of -x (exact comm match).
	 *  Required for Python-wrapped tools whose comm is "python3". */
	useCmdlineMatch?: boolean;
}

function pgrepFlag(config: ProcessConfig): string {
	return config.useCmdlineMatch ? '-f' : '-x';
}

function displayName(config: ProcessConfig): string {
	return config.displayName ?? config.name;
}

async function findProcessPids(config: ProcessConfig): Promise<ProcessEntry[]> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', [pgrepFlag(config), config.name]);
		const label = displayName(config);
		return stdout
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((pid) => ({ pid, name: label }));
	} catch {
		return [];
	}
}

/** Find running processes matching the given configs via pgrep. */
export async function findBlockingProcesses(configs: ProcessConfig[]): Promise<ProcessEntry[]> {
	const results = await Promise.all(configs.map(findProcessPids));
	return results.flat();
}

/** SIGKILL all processes matching the given configs via pkill, then wait for cleanup. */
export async function killMatchingProcesses(
	configs: ProcessConfig[],
	waitMs = 2000
): Promise<void> {
	for (const config of configs) {
		try {
			const flag = config.useCmdlineMatch ? '-f' : '-x';
			await execFileAsync('/usr/bin/pkill', ['-9', flag, config.name]);
		} catch (_error: unknown) {
			// Process not found or already dead
		}
	}
	await delay(waitMs);
}
