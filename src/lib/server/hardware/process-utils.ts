/**
 * Shared process detection and cleanup utilities for hardware managers.
 * Used by hackrf-manager.ts and alfa-manager.ts to find/kill blocking processes.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

/** Find running processes matching the given configs via pgrep. */
export async function findBlockingProcesses(configs: ProcessConfig[]): Promise<ProcessEntry[]> {
	const blocking: ProcessEntry[] = [];

	for (const config of configs) {
		try {
			const flag = config.useCmdlineMatch ? '-f' : '-x';
			const { stdout } = await execFileAsync('/usr/bin/pgrep', [flag, config.name]);
			const pids = stdout.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				blocking.push({ pid, name: config.displayName ?? config.name });
			}
		} catch (_error: unknown) {
			// Process not found — pgrep exits non-zero when no match
		}
	}

	return blocking;
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
	await new Promise((resolve) => setTimeout(resolve, waitMs));
}
