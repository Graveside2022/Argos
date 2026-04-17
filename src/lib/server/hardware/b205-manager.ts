import { execFileAsync } from '$lib/server/exec';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import type { ProcessConfig } from './process-utils';
import { findBlockingProcesses, killMatchingProcesses } from './process-utils';

const B205_PROCESS_CONFIGS: ProcessConfig[] = [
	{ name: 'uhd_find_devices' },
	{ name: 'uhd_usrp_probe' },
	{ name: 'uhd_fft' },
	{ name: 'rx_samples_to_file' },
	{ name: 'fpv_energy_scan.py', displayName: 'FPV Detect', useCmdlineMatch: true },
	{ name: 'gnuradio-companion', useCmdlineMatch: true }
];

const B205_USB_ID = '2500:0022';

const B205_SERVICES = ['wardragon-fpv-detect.service'];

export async function detectB205(): Promise<boolean> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/lsusb', [], { timeout: 3000 });
		return stdout.includes(B205_USB_ID);
	} catch (_error: unknown) {
		return false;
	}
}

export async function getBlockingProcesses(): Promise<{ pid: string; name: string }[]> {
	return findBlockingProcesses(B205_PROCESS_CONFIGS);
}

export async function killBlockingProcesses(): Promise<void> {
	return killMatchingProcesses(B205_PROCESS_CONFIGS);
}

async function stopOne(unit: string): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['-n', '/usr/bin/systemctl', 'stop', unit], {
			timeout: 10000
		});
		logger.info('[b205-manager] stopped service', { unit });
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn('[b205-manager] failed to stop service', { unit, error: msg });
	}
}

export async function stopServices(): Promise<void> {
	for (const unit of B205_SERVICES) await stopOne(unit);
	await delay(1500);
}

export async function getServiceStatus(): Promise<{ name: string; isActive: boolean }[]> {
	const results: { name: string; isActive: boolean }[] = [];
	for (const unit of B205_SERVICES) {
		try {
			const { stdout } = await execFileAsync('/usr/bin/systemctl', ['is-active', unit], {
				timeout: 3000
			});
			results.push({ name: unit, isActive: stdout.trim() === 'active' });
		} catch (_error: unknown) {
			results.push({ name: unit, isActive: false });
		}
	}
	return results;
}
