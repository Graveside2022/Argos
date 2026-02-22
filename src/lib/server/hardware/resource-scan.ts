/**
 * Orphan process scanning for hardware resource manager.
 * Detects and records ownership of HackRF and ALFA devices
 * from pre-existing host processes and containers.
 */

import { logger } from '$lib/utils/logger';

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { HardwareDevice, type ResourceState } from './types';

/**
 * Scan for orphan processes that may own hardware devices.
 * Updates the provided state map with discovered ownership.
 */
export async function scanForOrphans(state: Map<HardwareDevice, ResourceState>): Promise<void> {
	try {
		// Check HackRF processes
		const hackrfProcesses = await hackrfMgr.getBlockingProcesses();
		if (hackrfProcesses.length > 0) {
			const owner = hackrfProcesses[0].name;
			logger.info('[ResourceManager] Orphan scan: HackRF process found', { owner });
			state.set(HardwareDevice.HACKRF, {
				device: HardwareDevice.HACKRF,
				isAvailable: false,
				owner,
				connectedSince: Date.now(),
				isDetected: true
			});
		} else {
			const detected = await hackrfMgr.detectHackRF();
			logger.info('[ResourceManager] Orphan scan: HackRF status', {
				detected,
				blockingProcesses: 0
			});
			const current = state.get(HardwareDevice.HACKRF);
			if (current) {
				current.isDetected = detected;
				state.set(HardwareDevice.HACKRF, current);
			}
		}

		// Check HackRF tool containers (not the default backend)
		const containers = await hackrfMgr.getContainerStatus(true);
		for (const c of containers) {
			if (c.isRunning) {
				logger.info('[ResourceManager] Orphan scan: HackRF tool container running', {
					container: c.name
				});
				state.set(HardwareDevice.HACKRF, {
					device: HardwareDevice.HACKRF,
					isAvailable: false,
					owner: c.name,
					connectedSince: Date.now(),
					isDetected: true
				});
				break;
			}
		}

		// Check ALFA
		const alfaIface = await alfaMgr.detectAdapter();
		const alfaProcesses = await alfaMgr.getBlockingProcesses();
		if (alfaProcesses.length > 0) {
			logger.info('[ResourceManager] Orphan scan: ALFA process found', {
				process: alfaProcesses[0].name
			});
			state.set(HardwareDevice.ALFA, {
				device: HardwareDevice.ALFA,
				isAvailable: false,
				owner: alfaProcesses[0].name,
				connectedSince: Date.now(),
				isDetected: !!alfaIface
			});
		} else {
			logger.info('[ResourceManager] Orphan scan: ALFA status', {
				detected: !!alfaIface,
				blockingProcesses: 0
			});
			const current = state.get(HardwareDevice.ALFA);
			if (current) {
				current.isDetected = !!alfaIface;
				state.set(HardwareDevice.ALFA, current);
			}
		}

		logger.info('[ResourceManager] Orphan scan complete');
	} catch (error) {
		logger.error('[ResourceManager] Orphan scan failed', { error: String(error) });
	}
}
