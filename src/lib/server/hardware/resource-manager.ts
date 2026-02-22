import { EventEmitter } from 'events';

import { logger } from '$lib/utils/logger';

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { HardwareDevice, type HardwareStatus, type ResourceState } from './types';

class ResourceManager extends EventEmitter {
	private state: Map<HardwareDevice, ResourceState> = new Map();
	private mutex: Map<HardwareDevice, boolean> = new Map();

	constructor() {
		super();
		this.initializeState();
		this.scanForOrphans();
		// Re-scan periodically to keep isDetected status fresh
		setInterval(() => this.refreshDetection(), 30000);
	}

	private initializeState(): void {
		for (const device of Object.values(HardwareDevice)) {
			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: false
			});
			this.mutex.set(device, false);
		}
	}

	private async scanForOrphans(): Promise<void> {
		try {
			// Check HackRF processes
			const hackrfProcesses = await hackrfMgr.getBlockingProcesses();
			if (hackrfProcesses.length > 0) {
				const owner = hackrfProcesses[0].name;
				logger.info('[ResourceManager] Orphan scan: HackRF process found', { owner });
				this.state.set(HardwareDevice.HACKRF, {
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
				const current = this.state.get(HardwareDevice.HACKRF);
				if (current) {
					current.isDetected = detected;
					this.state.set(HardwareDevice.HACKRF, current);
				}
			}

			// Check HackRF tool containers (not the default backend)
			const containers = await hackrfMgr.getContainerStatus(true);
			for (const c of containers) {
				if (c.isRunning) {
					logger.info('[ResourceManager] Orphan scan: HackRF tool container running', {
						container: c.name
					});
					this.state.set(HardwareDevice.HACKRF, {
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
				this.state.set(HardwareDevice.ALFA, {
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
				const current = this.state.get(HardwareDevice.ALFA);
				if (current) {
					current.isDetected = !!alfaIface;
					this.state.set(HardwareDevice.ALFA, current);
				}
			}

			logger.info('[ResourceManager] Orphan scan complete');
		} catch (error) {
			logger.error('[ResourceManager] Orphan scan failed', { error: String(error) });
		}
	}

	private async refreshDetection(): Promise<void> {
		try {
			// --- HackRF: detection + ownership ---
			const hackrfDetected = await hackrfMgr.detectHackRF();
			const hackrfCurrent = this.state.get(HardwareDevice.HACKRF);
			if (!hackrfCurrent) return;
			hackrfCurrent.isDetected = hackrfDetected;

			const hackrfProcesses = await hackrfMgr.getBlockingProcesses();
			const hackrfContainers = await hackrfMgr.getContainerStatus(true);
			const runningContainer = hackrfContainers.find((c) => c.isRunning);

			if (hackrfProcesses.length > 0) {
				hackrfCurrent.owner = hackrfProcesses[0].name;
				hackrfCurrent.isAvailable = false;
				if (!hackrfCurrent.connectedSince) hackrfCurrent.connectedSince = Date.now();
			} else if (runningContainer) {
				hackrfCurrent.owner = runningContainer.name;
				hackrfCurrent.isAvailable = false;
				if (!hackrfCurrent.connectedSince) hackrfCurrent.connectedSince = Date.now();
			} else if (hackrfCurrent.owner) {
				// Owner process/container no longer running — release
				hackrfCurrent.owner = null;
				hackrfCurrent.isAvailable = true;
				hackrfCurrent.connectedSince = null;
			}
			this.state.set(HardwareDevice.HACKRF, hackrfCurrent);

			// --- ALFA: detection + ownership ---
			const alfaIface = await alfaMgr.detectAdapter();
			const alfaCurrent = this.state.get(HardwareDevice.ALFA);
			if (!alfaCurrent) return;
			alfaCurrent.isDetected = !!alfaIface;

			const alfaProcesses = await alfaMgr.getBlockingProcesses();
			if (alfaProcesses.length > 0) {
				alfaCurrent.owner = alfaProcesses[0].name;
				alfaCurrent.isAvailable = false;
				if (!alfaCurrent.connectedSince) alfaCurrent.connectedSince = Date.now();
			} else if (alfaCurrent.owner) {
				// Owner process no longer running — release
				alfaCurrent.owner = null;
				alfaCurrent.isAvailable = true;
				alfaCurrent.connectedSince = null;
			}
			this.state.set(HardwareDevice.ALFA, alfaCurrent);
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.warn(
				'[ResourceManager] Hardware detection refresh failed',
				{ error: msg, operation: 'hardware.detect' },
				'resource-detect'
			);
		}
	}

	private async acquireMutex(device: HardwareDevice): Promise<boolean> {
		const maxWait = 5000;
		const start = Date.now();
		while (this.mutex.get(device)) {
			if (Date.now() - start > maxWait) return false;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		this.mutex.set(device, true);
		return true;
	}

	private releaseMutex(device: HardwareDevice): void {
		this.mutex.set(device, false);
	}

	async acquire(
		toolName: string,
		device: HardwareDevice
	): Promise<{ success: boolean; owner?: string }> {
		const gotMutex = await this.acquireMutex(device);
		if (!gotMutex) {
			return { success: false, owner: 'mutex-timeout' };
		}

		try {
			const current = this.state.get(device);
			if (!current) {
				return { success: false, owner: 'device-not-found' };
			}
			if (!current.isAvailable) {
				return { success: false, owner: current.owner ?? 'unknown' };
			}

			this.state.set(device, {
				device,
				isAvailable: false,
				owner: toolName,
				connectedSince: Date.now(),
				isDetected: current.isDetected
			});

			this.emit('acquired', { device, toolName });
			return { success: true };
		} finally {
			this.releaseMutex(device);
		}
	}

	async release(
		toolName: string,
		device: HardwareDevice
	): Promise<{ success: boolean; error?: string }> {
		const gotMutex = await this.acquireMutex(device);
		if (!gotMutex) {
			return { success: false, error: 'mutex-timeout' };
		}

		try {
			const current = this.state.get(device);
			if (!current) {
				return { success: false, error: 'device-not-found' };
			}
			if (current.owner !== toolName) {
				return {
					success: false,
					error: `Not owner. Current owner: ${current.owner}`
				};
			}

			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: current.isDetected
			});

			this.emit('released', { device, toolName });
			return { success: true };
		} finally {
			this.releaseMutex(device);
		}
	}

	async forceRelease(device: HardwareDevice): Promise<{ success: boolean }> {
		const gotMutex = await this.acquireMutex(device);
		if (!gotMutex) {
			return { success: false };
		}

		try {
			const current = this.state.get(device);
			if (!current) {
				return { success: false };
			}
			const previousOwner = current.owner;

			// Kill processes based on device type
			if (device === HardwareDevice.HACKRF) {
				await hackrfMgr.killBlockingProcesses();
				await hackrfMgr.stopContainers();
			} else if (device === HardwareDevice.ALFA) {
				await alfaMgr.killBlockingProcesses();
			}

			this.state.set(device, {
				device,
				isAvailable: true,
				owner: null,
				connectedSince: null,
				isDetected: current.isDetected
			});

			this.emit('force-released', { device, previousOwner });
			return { success: true };
		} finally {
			this.releaseMutex(device);
		}
	}

	getStatus(): HardwareStatus {
		const hackrf = this.state.get(HardwareDevice.HACKRF);
		const alfa = this.state.get(HardwareDevice.ALFA);
		const bluetooth = this.state.get(HardwareDevice.BLUETOOTH);

		if (!hackrf || !alfa || !bluetooth) {
			throw new Error('Hardware state not initialized');
		}

		return {
			hackrf: { ...hackrf },
			alfa: { ...alfa },
			bluetooth: { ...bluetooth }
		};
	}

	isAvailable(device: HardwareDevice): boolean {
		return this.state.get(device)?.isAvailable ?? false;
	}

	getOwner(device: HardwareDevice): string | null {
		return this.state.get(device)?.owner ?? null;
	}
}

// Singleton
export const resourceManager = new ResourceManager();

/** Returns the singleton ResourceManager for tracking hardware device ownership and contention. */
export function getResourceManager(): ResourceManager {
	return resourceManager;
}
