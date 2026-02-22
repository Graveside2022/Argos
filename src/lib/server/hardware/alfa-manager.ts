import { execFile } from 'child_process';
import { promisify } from 'util';

import { AlfaDetector } from '$lib/server/kismet/alfa-detector';
import { validateInterfaceName } from '$lib/server/security/input-sanitizer';

const execFileAsync = promisify(execFile);

const ALFA_BLOCKING_PROCESSES = ['kismet', 'wifite', 'bettercap', 'airodump-ng', 'aireplay-ng'];

/** Detects the ALFA USB Wi-Fi adapter and returns its interface name, or null if absent. */
export async function detectAdapter(): Promise<string | null> {
	return AlfaDetector.getAlfaInterface();
}

/** Returns the current wireless mode (monitor, managed, or unknown) for the given interface. */
export async function getMode(iface: string): Promise<'monitor' | 'managed' | 'unknown'> {
	const validIface = validateInterfaceName(iface);
	try {
		const { stdout } = await execFileAsync('/usr/sbin/iwconfig', [validIface]);
		if (stdout.includes('Mode:Monitor')) return 'monitor';
		if (stdout.includes('Mode:Managed')) return 'managed';
		return 'unknown';
	} catch (_error: unknown) {
		return 'unknown';
	}
}

/** Returns a list of running processes (kismet, wifite, bettercap, etc.) that may block ALFA adapter access. */
export async function getBlockingProcesses(): Promise<{ pid: string; name: string }[]> {
	const blocking: { pid: string; name: string }[] = [];

	for (const proc of ALFA_BLOCKING_PROCESSES) {
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

/** Forcefully kills all processes that may block ALFA adapter access, then waits for cleanup. */
export async function killBlockingProcesses(): Promise<void> {
	for (const proc of ALFA_BLOCKING_PROCESSES) {
		try {
			await execFileAsync('/usr/bin/pkill', ['-9', '-x', proc]);
		} catch (_error: unknown) {
			// Process not found
		}
	}
	await new Promise((resolve) => setTimeout(resolve, 2000));
}
