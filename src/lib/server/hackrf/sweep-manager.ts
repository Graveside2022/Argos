import { EventEmitter } from 'events';

import { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import {
	type CyclingHealth,
	forceCleanupExistingProcesses,
	type HealthCheckContext,
	performHealthCheck,
	performRecovery
} from '$lib/hackrf/sweep-manager/sweep-health-checker';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { SystemStatus } from '$lib/types/enums';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

import {
	handleProcessExit,
	handleSpectrumData,
	startSweepProcess,
	type SweepCoordinatorContext,
	testHackrfAvailability
} from './sweep-coordinator';
import {
	type CycleInitContext,
	type CycleRuntimeContext,
	runNextFrequency,
	startCycle
} from './sweep-cycle-init';
import type {
	HackRFHealth,
	SpectrumData,
	SweepConfig,
	SweepMutableState,
	SweepStatus
} from './types';

/** Manages HackRF sweep operations using modular service architecture. */
export class SweepManager extends EventEmitter {
	/** Shared mutable state — passed by reference to cycle-init/runtime contexts. */
	private readonly mutableState: SweepMutableState = {
		isRunning: false,
		isInitialized: false,
		status: { state: SystemStatus.Idle }
	};
	private processManager: ProcessManager;
	private frequencyCycler: FrequencyCycler;
	private bufferManager: BufferManager;
	private errorTracker: ErrorTracker;
	private cyclingHealth: CyclingHealth = {
		status: SystemStatus.Idle,
		processHealth: 'unknown' as string,
		processStartupPhase: 'none' as string,
		lastSwitchTime: null,
		lastDataReceived: null,
		recovery: {
			recoveryAttempts: 0,
			maxRecoveryAttempts: 3,
			lastRecoveryAttempt: null,
			isRecovering: false
		}
	};
	private healthMonitorInterval: ReturnType<typeof setInterval>;
	private sseEmitter: ((event: string, data: unknown) => void) | null = null;

	constructor() {
		super();
		this.processManager = new ProcessManager();
		this.frequencyCycler = new FrequencyCycler();
		this.bufferManager = new BufferManager();
		this.errorTracker = new ErrorTracker();

		this.healthMonitorInterval = setInterval(() => {
			this._performHealthCheck().catch((error) => {
				logError('Error performing health check', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, 30000);

		this._performStartupValidation().catch((error) => {
			logError('Error during startup validation', {
				error: error instanceof Error ? error.message : String(error)
			});
		});
	}

	setSseEmitter(emitter: ((event: string, data: unknown) => void) | null): void {
		this.sseEmitter = emitter;
	}
	private async _performStartupValidation(): Promise<void> {
		logInfo('[SEARCH] SweepManager: Performing startup state validation...');
		this.mutableState.isRunning = false;
		this.mutableState.status = { state: SystemStatus.Idle };
		await forceCleanupExistingProcesses(this.processManager);
		await this.processManager.cleanup();
		this.frequencyCycler.resetCycling();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();
		const rs = this.errorTracker.getRecoveryStatus();
		Object.assign(this.cyclingHealth, {
			status: SystemStatus.Idle,
			processHealth: 'stopped',
			lastDataReceived: null
		});
		Object.assign(this.cyclingHealth.recovery, {
			recoveryAttempts: rs.recoveryAttempts,
			lastRecoveryAttempt: rs.lastRecoveryAttempt,
			isRecovering: rs.isRecovering
		});
		this.mutableState.isInitialized = true;
		logInfo('[OK] SweepManager startup validation complete');
	}

	private _getCoordinatorContext(): SweepCoordinatorContext {
		return {
			processManager: this.processManager,
			frequencyCycler: this.frequencyCycler,
			bufferManager: this.bufferManager,
			errorTracker: this.errorTracker,
			emitEvent: (event, data) => this._emitEvent(event, data),
			emitError: (msg, type, err) => this._emitError(msg, type, err),
			updateCyclingHealth: (update) => {
				if (update.lastDataReceived !== undefined)
					this.cyclingHealth.lastDataReceived = update.lastDataReceived;
				if (update.processHealth !== undefined)
					this.cyclingHealth.processHealth = update.processHealth;
			},
			isRunning: this.mutableState.isRunning
		};
	}

	private _getHealthContext(): HealthCheckContext {
		return {
			...this._getCoordinatorContext(),
			cyclingHealth: this.cyclingHealth,
			startSweepProcess: (freq) => this._startSweepProcess(freq),
			stopSweep: () => this.stopSweep()
		};
	}

	private async _performHealthCheck(): Promise<void> {
		await performHealthCheck(this._getHealthContext());
	}

	async startSweep(config: SweepConfig): Promise<void> {
		if (this.mutableState.status.state === SystemStatus.Running)
			throw new Error('Sweep already in progress');
		const frequencies = config.frequencies || [{ value: config.centerFrequency, unit: 'Hz' }];
		const success = await startCycle(
			this._getCycleInitContext(),
			frequencies,
			config.cycleTime || 10000
		);
		if (!success) throw new Error('Failed to start sweep');
	}

	async startCycle(
		frequencies: Array<{ value: number; unit: string }>,
		cycleTime: number
	): Promise<boolean> {
		return startCycle(this._getCycleInitContext(), frequencies, cycleTime);
	}

	private _getCycleInitContext(): CycleInitContext {
		return {
			state: this.mutableState,
			processManager: this.processManager,
			frequencyCycler: this.frequencyCycler,
			emitEvent: (event: string, data: unknown) => this._emitEvent(event, data),
			emitError: (msg: string, type: string, err?: Error) => this._emitError(msg, type, err),
			resetErrorTracking: () => this.errorTracker.resetErrorTracking(),
			runNextFrequency: () => this._runNextFrequency()
		};
	}

	async stopSweep(): Promise<void> {
		logInfo('[STOP] Stopping sweep... Current state:', {
			state: this.mutableState.status.state
		});
		if (this.mutableState.status.state === SystemStatus.Idle) {
			logInfo('Sweep already stopped');
			return;
		}
		this.mutableState.status.state = SystemStatus.Stopping;
		this._emitEvent('status', this.mutableState.status);
		this.frequencyCycler.stopCycling();
		this.mutableState.isRunning = false;
		const processState = this.processManager.getProcessState();
		await this.processManager.stopProcess(processState);
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();
		this.mutableState.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.mutableState.status);
		this._emitEvent('status_change', { status: 'stopped' });
		await resourceManager.release('hackrf-sweep', HardwareDevice.HACKRF);
		setTimeout(() => this._emitEvent('status', { state: SystemStatus.Idle }), 100);
		logInfo('Sweep stopped successfully');
	}

	async emergencyStop(): Promise<void> {
		logWarn('[ALERT] Emergency stop initiated');
		this.mutableState.isRunning = false;
		this.frequencyCycler.emergencyStop();
		await this.processManager.forceKillProcess();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();
		this.cyclingHealth.status = SystemStatus.Idle;
		this.cyclingHealth.processHealth = 'stopped';
		this.cyclingHealth.lastDataReceived = null;
		this.mutableState.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.mutableState.status);
		this._emitEvent('status_change', { status: 'emergency_stopped' });
		logWarn('[ALERT] Emergency stop completed');
	}

	async forceCleanup(): Promise<void> {
		await forceCleanupExistingProcesses(this.processManager);
		this.mutableState.status = { state: SystemStatus.Idle };
	}

	getStatus(): SweepStatus {
		return { ...this.mutableState.status };
	}

	async checkHealth(): Promise<HackRFHealth> {
		const check = await testHackrfAvailability();
		return {
			connected: check.available,
			deviceInfo: check.deviceInfo,
			error: check.available ? undefined : check.reason,
			lastUpdate: Date.now()
		};
	}

	private _getCycleRuntimeContext(): CycleRuntimeContext {
		return {
			state: this.mutableState,
			frequencyCycler: this.frequencyCycler,
			processManager: this.processManager,
			errorTracker: this.errorTracker,
			emitEvent: (event, data) => this._emitEvent(event, data),
			getCoordinatorContext: () => this._getCoordinatorContext(),
			startSweepProcess: (freq) => this._startSweepProcess(freq),
			stopSweep: () => this.stopSweep()
		};
	}

	private async _runNextFrequency(): Promise<void> {
		await runNextFrequency(this._getCycleRuntimeContext());
	}

	private async _startSweepProcess(frequency: { value: number; unit: string }): Promise<void> {
		const ctx = this._getCoordinatorContext();
		await startSweepProcess(
			ctx,
			frequency,
			(data: SpectrumData, freq: { value: number; unit: string }) => {
				handleSpectrumData(ctx, data, freq, this.cyclingHealth.processHealth);
			},
			(code: number | null, signal: string | null) => {
				handleProcessExit(ctx, code, signal, (reason: string) => {
					performRecovery(this._getHealthContext(), reason).catch((error) => {
						logError('Error performing recovery', {
							error: error instanceof Error ? error.message : String(error)
						});
					});
				});
				if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
			}
		);
	}

	private _emitEvent(event: string, data: unknown): void {
		if (this.sseEmitter) {
			try {
				this.sseEmitter(event, data);
			} catch (error) {
				logWarn('SSE emitter error, clearing reference', { error });
				this.sseEmitter = null;
			}
		}
		if (this.listenerCount(event) > 0) this.emit(event, data);
	}

	private _emitError(message: string, type: string, error?: Error): void {
		this._emitEvent('error', {
			message,
			type,
			timestamp: new Date().toISOString(),
			details: error?.stack
		});
		logError(`[ERROR] ${type}: ${message}`, { type, details: error?.stack });
	}

	async cleanup(): Promise<void> {
		if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
		await this.emergencyStop();
	}
}

// Singleton — persisted via globalThis to survive Vite HMR reloads.
const KEY = '__argos_sweepManager';
const g = globalThis as Record<string, unknown>;
/** The singleton SweepManager instance for controlling HackRF spectrum sweeps. */
export const sweepManager: SweepManager =
	(g[KEY] as SweepManager) ?? ((g[KEY] = new SweepManager()) as SweepManager);
/** Returns the singleton SweepManager instance. */
export function getSweepManager(): SweepManager {
	return sweepManager;
}
