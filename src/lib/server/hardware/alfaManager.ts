import { exec } from 'child_process';
import { promisify } from 'util';
import { AlfaDetector } from '$lib/server/kismet/alfa_detector';

const execAsync = promisify(exec);

const ALFA_BLOCKING_PROCESSES = ['kismet', 'wifite', 'bettercap', 'airodump-ng', 'aireplay-ng'];

export async function detectAdapter(): Promise<string | null> {
	return AlfaDetector.getAlfaInterface();
}

export async function getMode(iface: string): Promise<'monitor' | 'managed' | 'unknown'> {
	try {
		const { stdout } = await execAsync(`iwconfig "${iface}" 2>/dev/null`);
		if (stdout.includes('Mode:Monitor')) return 'monitor';
		if (stdout.includes('Mode:Managed')) return 'managed';
		return 'unknown';
	} catch {
		return 'unknown';
	}
}

export async function getBlockingProcesses(): Promise<{ pid: string; name: string }[]> {
	const blocking: { pid: string; name: string }[] = [];

	for (const proc of ALFA_BLOCKING_PROCESSES) {
		try {
			const { stdout } = await execAsync(`pgrep -x "${proc}" 2>/dev/null`);
			const pids = stdout.trim().split('\n').filter(Boolean);
			for (const pid of pids) {
				blocking.push({ pid, name: proc });
			}
		} catch {
			// Process not found
		}
	}

	return blocking;
}

export async function killBlockingProcesses(): Promise<void> {
	for (const proc of ALFA_BLOCKING_PROCESSES) {
		try {
			await execAsync(`pkill -9 -x "${proc}" 2>/dev/null`);
		} catch {
			// Process not found
		}
	}
	await new Promise((resolve) => setTimeout(resolve, 2000));
}
