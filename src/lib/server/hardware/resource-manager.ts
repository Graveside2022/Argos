import { EventEmitter } from 'events';

import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';

import * as alfaMgr from './alfa-manager';
import * as hackrfMgr from './hackrf-manager';
import { canonicalizeWebRxOwner } from './hackrf-owner-aliases';
import { scanForOrphans } from './resource-scan';
import { HardwareDevice, type HardwareStatus, type ResourceState } from './types';

/**
 * Canonical tool names used when a service calls `acquire(toolName, device)`.
 * When the background refresh scan detects a live process or container on the
 * device, we compare the current owner against this set: if the owner is a
 * known tool name (from an explicit acquire()), we preserve it instead of
 * overwriting with the container/process name from the scan. This keeps the
 * status endpoint's `owner` field stable as 'novasdr' / 'openwebrx' / etc.
 * rather than drifting to 'novasdr-hackrf' / 'GSM Evil' / etc. on each tick.
 */
const KNOWN_TOOL_NAMES: ReadonlySet<string> = new Set([
	'openwebrx',
	'novasdr',
	'gsm-evil',
	'kismet',
	'kismet-wifi',
	'bluehood',
	'spiderfoot',
	'sightline',
	'pagermon',
	'sdrpp'
]);

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

	/**
	 * True when the current app-level owner should be preserved across a
	 * refresh tick instead of being overwritten by the scanned process/
	 * container name. See KNOWN_TOOL_NAMES for rationale.
	 */
	private shouldPreserveExplicitOwner(state: ResourceState, ownerName: string | null): boolean {
		return (
			ownerName !== null &&
			state.owner !== null &&
			state.owner !== ownerName &&
			KNOWN_TOOL_NAMES.has(state.owner)
		);
	}

	/** Mark the device as held; preserve existing connectedSince if set. */
	private markOwned(state: ResourceState, ownerName: string): void {
		state.owner = ownerName;
		state.isAvailable = false;
		if (!state.connectedSince) state.connectedSince = Date.now();
	}

	/** Clear all ownership fields on the device. */
	private markFree(state: ResourceState): void {
		state.owner = null;
		state.isAvailable = true;
		state.connectedSince = null;
	}

	private applyOwnership(state: ResourceState, ownerName: string | null): void {
		if (this.shouldPreserveExplicitOwner(state, ownerName)) {
			state.isAvailable = false;
			if (!state.connectedSince) state.connectedSince = Date.now();
			return;
		}
		if (ownerName) this.markOwned(state, ownerName);
		else if (state.owner) this.markFree(state);
	}

	private resolveHackrfOwner(
		processes: { name: string }[],
		containers: { isRunning: boolean; name: string }[]
	): string | null {
		const raw = processes.length > 0 ? processes[0].name : null;
		if (raw) return canonicalizeWebRxOwner(raw);
		const running = containers.find((c) => c.isRunning);
		return running ? canonicalizeWebRxOwner(running.name) : null;
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

	/**
	 * On-demand refresh of a single device's detection state. Call this from
	 * control endpoints immediately after a docker/process lifecycle command
	 * so that the next status poll returns fresh data without waiting up to
	 * 30 seconds for the scheduled background refresh. Errors are swallowed
	 * and logged — a refresh failure must never break a control action.
	 */
	async refreshNow(device: HardwareDevice): Promise<void> {
		try {
			if (device === HardwareDevice.HACKRF) await this.refreshHackrf();
			else if (device === HardwareDevice.ALFA) await this.refreshAlfa();
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			logger.warn(
				'[ResourceManager] On-demand refresh failed',
				{ device, error: msg, operation: 'hardware.refreshNow' },
				'resource-refresh'
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

	private checkExistingOwnership(
		toolName: string,
		current: ResourceState
	): { success: boolean; owner?: string } | null {
		if (!current.isAvailable && current.owner === toolName) {
			return { success: true, owner: toolName };
		}
		if (!current.isAvailable) {
			return { success: false, owner: current.owner ?? 'unknown' };
		}
		return null;
	}

	private tryClaim(
		toolName: string,
		device: HardwareDevice
	): { success: boolean; owner?: string } {
		const current = this.state.get(device);
		if (!current) {
			return { success: false, owner: 'device-not-found' };
		}
		const existing = this.checkExistingOwnership(toolName, current);
		if (existing) return existing;
		this.state.set(device, {
			device,
			isAvailable: false,
			owner: toolName,
			connectedSince: Date.now(),
			isDetected: current.isDetected
		});
		this.emit('acquired', { device, toolName });
		return { success: true };
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
			return this.tryClaim(toolName, device);
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
