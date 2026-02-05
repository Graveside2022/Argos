import { EventEmitter } from 'events';
import { HardwareDevice, type ResourceState, type HardwareStatus } from './types';
import * as hackrfMgr from './hackrfManager';
import * as alfaMgr from './alfaManager';
import { logWarn } from '$lib/utils/logger';

class ResourceManager extends EventEmitter {
	private state: Map<HardwareDevice, ResourceState> = new Map();
	private mutex: Map<HardwareDevice, boolean> = new Map();

	constructor() {
		super();
		this.initializeState();
		this.scanForOrphans();
		// Re-scan periodically to keep detected status fresh
		setInterval(() => this.refreshDetection(), 30000);
	}

	private initializeState(): void {
		for (const device of Object.values(HardwareDevice)) {
			this.state.set(device, {
				device,
				available: true,
				owner: null,
				connectedSince: null,
				detected: false
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
				console.log(`[ResourceManager] Orphan scan: HackRF process found: ${owner}`);
				this.state.set(HardwareDevice.HACKRF, {
					device: HardwareDevice.HACKRF,
					available: false,
					owner,
					connectedSince: Date.now(),
					detected: true
				});
			} else {
				const detected = await hackrfMgr.detectHackRF();
				console.log(
					`[ResourceManager] Orphan scan: HackRF detected=${detected}, no blocking processes`
				);
				const current = this.state.get(HardwareDevice.HACKRF)!;
				current.detected = detected;
				this.state.set(HardwareDevice.HACKRF, current);
			}

			// Check HackRF tool containers (not the default backend)
			const containers = await hackrfMgr.getContainerStatus(true);
			for (const c of containers) {
				if (c.running) {
					console.log(
						`[ResourceManager] Orphan scan: HackRF tool container running: ${c.name}`
					);
					this.state.set(HardwareDevice.HACKRF, {
						device: HardwareDevice.HACKRF,
						available: false,
						owner: c.name,
						connectedSince: Date.now(),
						detected: true
					});
					break;
				}
			}

			// Check ALFA
			const alfaIface = await alfaMgr.detectAdapter();
			const alfaProcesses = await alfaMgr.getBlockingProcesses();
			if (alfaProcesses.length > 0) {
				console.log(
					`[ResourceManager] Orphan scan: ALFA process found: ${alfaProcesses[0].name}`
				);
				this.state.set(HardwareDevice.ALFA, {
					device: HardwareDevice.ALFA,
					available: false,
					owner: alfaProcesses[0].name,
					connectedSince: Date.now(),
					detected: !!alfaIface
				});
			} else {
				console.log(
					`[ResourceManager] Orphan scan: ALFA detected=${!!alfaIface}, no blocking processes`
				);
				const current = this.state.get(HardwareDevice.ALFA)!;
				current.detected = !!alfaIface;
				this.state.set(HardwareDevice.ALFA, current);
			}

			console.log('[ResourceManager] Orphan scan complete');
		} catch (error) {
			console.error('[ResourceManager] Orphan scan failed:', error);
		}
	}

	private async refreshDetection(): Promise<void> {
		try {
			const hackrfDetected = await hackrfMgr.detectHackRF();
			const current = this.state.get(HardwareDevice.HACKRF)!;
			current.detected = hackrfDetected;
			this.state.set(HardwareDevice.HACKRF, current);

			const alfaIface = await alfaMgr.detectAdapter();
			const alfaCurrent = this.state.get(HardwareDevice.ALFA)!;
			alfaCurrent.detected = !!alfaIface;
			this.state.set(HardwareDevice.ALFA, alfaCurrent);
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logWarn(
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
			const current = this.state.get(device)!;
			if (!current.available) {
				return { success: false, owner: current.owner ?? 'unknown' };
			}

			this.state.set(device, {
				device,
				available: false,
				owner: toolName,
				connectedSince: Date.now(),
				detected: current.detected
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
			const current = this.state.get(device)!;
			if (current.owner !== toolName) {
				return {
					success: false,
					error: `Not owner. Current owner: ${current.owner}`
				};
			}

			this.state.set(device, {
				device,
				available: true,
				owner: null,
				connectedSince: null,
				detected: current.detected
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
			const current = this.state.get(device)!;
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
				available: true,
				owner: null,
				connectedSince: null,
				detected: current.detected
			});

			this.emit('force-released', { device, previousOwner });
			return { success: true };
		} finally {
			this.releaseMutex(device);
		}
	}

	getStatus(): HardwareStatus {
		return {
			hackrf: { ...this.state.get(HardwareDevice.HACKRF)! },
			alfa: { ...this.state.get(HardwareDevice.ALFA)! },
			bluetooth: { ...this.state.get(HardwareDevice.BLUETOOTH)! }
		};
	}

	isAvailable(device: HardwareDevice): boolean {
		return this.state.get(device)?.available ?? false;
	}

	getOwner(device: HardwareDevice): string | null {
		return this.state.get(device)?.owner ?? null;
	}
}

// Singleton
export const resourceManager = new ResourceManager();

export function getResourceManager(): ResourceManager {
	return resourceManager;
}
