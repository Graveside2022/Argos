/**
 * Orphan process scanning for hardware resource manager.
 * Detects and records ownership of HackRF and ALFA devices
 * from pre-existing host processes and containers.
 */

import { logger } from '$lib/utils/logger';

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { HardwareDevice, type ResourceState } from './types';

function buildOwnedState(device: HardwareDevice, owner: string, detected: boolean): ResourceState {
	return {
		device,
		isAvailable: false,
		owner,
		connectedSince: Date.now(),
		isDetected: detected
	};
}

function updateDetection(
	state: Map<HardwareDevice, ResourceState>,
	device: HardwareDevice,
	detected: boolean
): void {
	const current = state.get(device);
	if (!current) return;
	current.isDetected = detected;
	state.set(device, current);
}

async function scanHackrfProcesses(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	const processes = await hackrfMgr.getBlockingProcesses();
	if (processes.length > 0) {
		const owner = processes[0].name;
		logger.info('[ResourceManager] Orphan scan: HackRF process found', { owner });
		state.set(HardwareDevice.HACKRF, buildOwnedState(HardwareDevice.HACKRF, owner, true));
		return;
	}
	const detected = await hackrfMgr.detectHackRF();
	logger.info('[ResourceManager] Orphan scan: HackRF status', { detected, blockingProcesses: 0 });
	updateDetection(state, HardwareDevice.HACKRF, detected);
}

async function scanHackrfContainers(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	const containers = await hackrfMgr.getContainerStatus(true);
	const running = containers.find((c) => c.isRunning);
	if (!running) return;
	logger.info('[ResourceManager] Orphan scan: HackRF tool container running', {
		container: running.name
	});
	state.set(HardwareDevice.HACKRF, buildOwnedState(HardwareDevice.HACKRF, running.name, true));
}

async function scanAlfa(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	const alfaIface = await alfaMgr.detectAdapter();
	const processes = await alfaMgr.getBlockingProcesses();
	if (processes.length > 0) {
		logger.info('[ResourceManager] Orphan scan: ALFA process found', {
			process: processes[0].name
		});
		state.set(
			HardwareDevice.ALFA,
			buildOwnedState(HardwareDevice.ALFA, processes[0].name, !!alfaIface)
		);
		return;
	}
	logger.info('[ResourceManager] Orphan scan: ALFA status', {
		detected: !!alfaIface,
		blockingProcesses: 0
	});
	updateDetection(state, HardwareDevice.ALFA, !!alfaIface);
}

/**
 * Scan for orphan processes that may own hardware devices.
 * Updates the provided state map with discovered ownership.
 */
export async function scanForOrphans(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	try {
		await scanHackrfProcesses(state);
		await scanHackrfContainers(state);
		await scanAlfa(state);
		logger.info('[ResourceManager] Orphan scan complete');
	} catch (error) {
		logger.error('[ResourceManager] Orphan scan failed', { error: String(error) });
	}
}
