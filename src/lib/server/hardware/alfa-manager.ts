import { execFileAsync } from '$lib/server/exec';
import { AlfaDetector } from '$lib/server/kismet/alfa-detector';
import { validateInterfaceName } from '$lib/server/security/input-sanitizer';

import type { ProcessConfig } from './process-utils';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

/** ALFA adapter process configs — all native binaries using exact comm match */
const ALFA_PROCESS_CONFIGS: ProcessConfig[] = [
	{ name: 'kismet' },
	{ name: 'wifite' },
	{ name: 'bettercap' },
	{ name: 'airodump-ng' },
	{ name: 'aireplay-ng' }
];

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
	return findBlockingProcesses(ALFA_PROCESS_CONFIGS);
}

/** Forcefully kills all processes that may block ALFA adapter access, then waits for cleanup. */
export async function killBlockingProcesses(): Promise<void> {
	return killMatchingProcesses(ALFA_PROCESS_CONFIGS);
}
