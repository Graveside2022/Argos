import { EventEmitter } from 'events';

import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { scanForOrphans } from './resource-scan';
import { HardwareDevice, type HardwareStatus, type ResourceState } from './types';

class ResourceManager extends EventEmitter {
	private state: Map<HardwareDevice, ResourceState> = new Map();
	private mutex: Map<HardwareDevice, boolean> = new Map();
	private refreshInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		super();
		this.initializeState();
		scanForOrphans(this.state);
		// Re-scan periodically to keep isDetected status fresh
		this.refreshInterval = setInterval(() => this.refreshDetection(), 30000);
	}

	dispose(): void {
		if (this.refreshInterval !== null) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
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

	private applyOwnership(state: ResourceState, ownerName: string | null): void {
		if (ownerName) {
			state.owner = ownerName;
			state.isAvailable = false;
			if (!state.connectedSince) state.connectedSince = Date.now();
		} else if (state.owner) {
			state.owner = null;
			state.isAvailable = true;
			state.connectedSince = null;
		}
	}

	private resolveHackrfOwner(
		processes: { name: string }[],
		containers: { isRunning: boolean; name: string }[]
	): string | null {
		if (processes.length > 0) return processes[0].name;
		const running = containers.find((c) => c.isRunning);
		return running ? running.name : null;
	}

	private async refreshHackrf(): Promise<void> {
		const current = this.state.get(HardwareDevice.HACKRF);
		if (!current) return;
		current.isDetected = await hackrfMgr.detectHackRF();
		const processes = await hackrfMgr.getBlockingProcesses();
		const containers = await hackrfMgr.getContainerStatus(true);
		this.applyOwnership(current, this.resolveHackrfOwner(processes, containers));
		this.state.set(HardwareDevice.HACKRF, current);
	}

	private async refreshAlfa(): Promise<void> {
		const current = this.state.get(HardwareDevice.ALFA);
		if (!current) return;
		current.isDetected = !!(await alfaMgr.detectAdapter());
		const processes = await alfaMgr.getBlockingProcesses();
		const owner = processes.length > 0 ? processes[0].name : null;
		this.applyOwnership(current, owner);
		this.state.set(HardwareDevice.ALFA, current);
	}

	private async refreshDetection(): Promise<void> {
		try {
			await this.refreshHackrf();
			await this.refreshAlfa();
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
			await delay(50);
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
