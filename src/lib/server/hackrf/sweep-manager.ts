import { EventEmitter } from 'events';

import { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import {
	type CyclingHealth,
	forceCleanupExistingProcesses,
	performHealthCheck,
	performRecovery
} from '$lib/hackrf/sweep-manager/sweep-health-checker';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { SystemStatus } from '$lib/types/enums';
import { logger } from '$lib/utils/logger';

import { sweepArgsFromCenter, testHackrfAvailability } from './sweep-coordinator';
import { runNextFrequency, startCycle } from './sweep-cycle-init';
import {
	type NarrowBandSweepParams,
	runCloseSweepLog,
	runNarrowBandSweep,
	runStartSweepProcessWithArgs
} from './sweep-manager-capture';
import {
	buildCoordinatorContext,
	buildCycleInitContext,
	buildCycleRuntimeContext,
	buildHealthContext,
	type ManagerDeps
} from './sweep-manager-contexts';
import {
	emitSweepError,
	emitSweepEvent,
	performStartupValidation
} from './sweep-manager-lifecycle';
import type { HackRFHealth, SweepArgs, SweepConfig, SweepMutableState, SweepStatus } from './types';

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
	private activeCaptureId: string | null = null;

	constructor() {
		super();
		this.processManager = new ProcessManager();
		this.frequencyCycler = new FrequencyCycler();
		this.bufferManager = new BufferManager();
		this.errorTracker = new ErrorTracker();

		this.healthMonitorInterval = setInterval(() => {
			this._performHealthCheck().catch((error) => {
				logger.error('Error performing health check', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, 30000);

		this._performStartupValidation().catch((error) => {
			logger.error('Error during startup validation', {
				error: error instanceof Error ? error.message : String(error)
			});
		});
	}

	setSseEmitter(emitter: ((event: string, data: unknown) => void) | null): void {
		this.sseEmitter = emitter;
	}
	private async _performStartupValidation(): Promise<void> {
		await performStartupValidation({
			mutableState: this.mutableState,
			processManager: this.processManager,
			frequencyCycler: this.frequencyCycler,
			bufferManager: this.bufferManager,
			errorTracker: this.errorTracker,
			cyclingHealth: this.cyclingHealth
		});
	}

	private _deps(): ManagerDeps {
		return {
			mutableState: this.mutableState,
			processManager: this.processManager,
			frequencyCycler: this.frequencyCycler,
			bufferManager: this.bufferManager,
			errorTracker: this.errorTracker,
			cyclingHealth: this.cyclingHealth,
			getActiveCaptureId: () => this.activeCaptureId,
			emitEvent: (event, data) => this._emitEvent(event, data),
			emitError: (msg, type, err) => this._emitError(msg, type, err),
			runNextFrequency: () => this._runNextFrequency(),
			startSweepProcess: (freq) => this._startSweepProcess(freq),
			stopSweep: () => this.stopSweep()
		};
	}

	setActiveCaptureId(id: string | null): void {
		this.activeCaptureId = id;
	}

	private async _performHealthCheck(): Promise<void> {
		await performHealthCheck(buildHealthContext(this._deps()));
	}

	private _cycleInit() {
		return buildCycleInitContext(this._deps(), () => this.errorTracker.resetErrorTracking());
	}

	async startSweep(config: SweepConfig): Promise<void> {
		if (this.mutableState.status.state === SystemStatus.Running)
			throw new Error('Sweep already in progress');
		const frequencies = config.frequencies || [{ value: config.centerFrequency, unit: 'Hz' }];
		const success = await startCycle(this._cycleInit(), frequencies, config.cycleTime || 10000);
		if (!success) throw new Error('Failed to start sweep');
	}

	async startCycle(
		frequencies: Array<{ value: number; unit: string }>,
		cycleTime: number
	): Promise<boolean> {
		return startCycle(this._cycleInit(), frequencies, cycleTime);
	}

	async stopSweep(): Promise<void> {
		logger.info('[STOP] Stopping sweep... Current state:', {
			state: this.mutableState.status.state
		});
		if (this.mutableState.status.state === SystemStatus.Idle) {
			logger.info('Sweep already stopped');
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
		logger.info('Sweep stopped successfully');
	}

	async emergencyStop(): Promise<void> {
		logger.warn('[ALERT] Emergency stop initiated');
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
		logger.warn('[ALERT] Emergency stop completed');
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

	private async _runNextFrequency(): Promise<void> {
		await runNextFrequency(buildCycleRuntimeContext(this._deps()));
	}

	private async _startSweepProcess(frequency: { value: number; unit: string }): Promise<void> {
		await this._startSweepProcessWithArgs(sweepArgsFromCenter(frequency), frequency);
	}

	private async _startSweepProcessWithArgs(
		args: SweepArgs,
		frequency: { value: number; unit: string }
	): Promise<void> {
		const deps = this._deps();
		await runStartSweepProcessWithArgs(
			{
				getCoordinatorContext: () => buildCoordinatorContext(deps),
				getProcessHealth: () => this.cyclingHealth.processHealth,
				onRecovery: (reason) => {
					performRecovery(buildHealthContext(deps), reason).catch((error) => {
						logger.error('Error performing recovery', {
							error: error instanceof Error ? error.message : String(error)
						});
					});
				},
				clearHealthMonitor: () => {
					if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
				}
			},
			args,
			frequency
		);
	}

	async startNarrowBandSweep(params: NarrowBandSweepParams): Promise<void> {
		await runNarrowBandSweep(
			{
				isRunning: () => this.mutableState.isRunning,
				stopSweep: () => this.stopSweep(),
				setActiveCaptureId: (id) => this.setActiveCaptureId(id),
				startSweepProcessWithArgs: (args, freq) =>
					this._startSweepProcessWithArgs(args, freq),
				markRunning: () => {
					this.mutableState.isRunning = true;
					this.mutableState.status = {
						state: SystemStatus.Running,
						currentFrequency: (params.startHz + params.endHz) / 2
					};
				}
			},
			params
		);
	}

	async closeSweepLogForCapture(captureId: string): Promise<void> {
		await runCloseSweepLog(
			{
				getActiveCaptureId: () => this.activeCaptureId,
				setActiveCaptureId: (id) => this.setActiveCaptureId(id),
				stopSweep: () => this.stopSweep()
			},
			captureId
		);
	}

	private _emitEvent(event: string, data: unknown): void {
		const result = emitSweepEvent(
			{ sseEmitter: this.sseEmitter, eventEmitter: this },
			event,
			data
		);
		this.sseEmitter = result.sseEmitter;
	}

	private _emitError(message: string, type: string, error?: Error): void {
		const result = emitSweepError(
			{ sseEmitter: this.sseEmitter, eventEmitter: this },
			message,
			type,
			error
		);
		this.sseEmitter = result.sseEmitter;
	}

	async cleanup(): Promise<void> {
		if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
		await this.emergencyStop();
	}
}

// Singleton persisted via globalThis to survive Vite HMR reloads.
export const sweepManager: SweepManager =
	globalThis.__argos_sweepManager ?? (globalThis.__argos_sweepManager = new SweepManager());
export const getSweepManager = (): SweepManager => sweepManager;
