import { execFile } from 'child_process';
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
import { convertToHz, convertToMHz, isCriticalError } from '$lib/hackrf/sweep-manager/sweep-utils';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { SystemStatus } from '$lib/types/enums';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

import type { HackRFHealth, SpectrumData, SweepConfig, SweepStatus } from './types';

/**
 * Manages HackRF sweep operations using modular service architecture.
 * Delegates to ProcessManager, FrequencyCycler, BufferManager, ErrorTracker,
 * and extracted modules (sweep-health-checker, sweep-utils).
 */
export class SweepManager extends EventEmitter {
	private status: SweepStatus = { state: SystemStatus.Idle };
	private isRunning = false;
	private isInitialized = false;

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

	private processMonitorInterval: ReturnType<typeof setInterval> | null = null;
	private dataTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
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
		this.isRunning = false;
		this.status = { state: SystemStatus.Idle };

		await forceCleanupExistingProcesses(this.processManager);

		await this.processManager.cleanup();
		this.frequencyCycler.resetCycling();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		const recoveryStatus = this.errorTracker.getRecoveryStatus();
		this.cyclingHealth.status = SystemStatus.Idle;
		this.cyclingHealth.processHealth = 'stopped';
		this.cyclingHealth.lastDataReceived = null;
		this.cyclingHealth.recovery.recoveryAttempts = recoveryStatus.recoveryAttempts;
		this.cyclingHealth.recovery.lastRecoveryAttempt = recoveryStatus.lastRecoveryAttempt;
		this.cyclingHealth.recovery.isRecovering = recoveryStatus.isRecovering;

		this.isInitialized = true;
		logInfo('[OK] SweepManager startup validation complete');
	}

	private _getHealthContext(): HealthCheckContext {
		return {
			isRunning: this.isRunning,
			cyclingHealth: this.cyclingHealth,
			processManager: this.processManager,
			frequencyCycler: this.frequencyCycler,
			bufferManager: this.bufferManager,
			errorTracker: this.errorTracker,
			emitEvent: (event, data) => this._emitEvent(event, data),
			emitError: (msg, type, err) => this._emitError(msg, type, err),
			startSweepProcess: (freq) => this._startSweepProcess(freq),
			stopSweep: () => this.stopSweep()
		};
	}

	private async _performHealthCheck(): Promise<void> {
		await performHealthCheck(this._getHealthContext());
	}

	async startSweep(config: SweepConfig): Promise<void> {
		if (this.status.state === SystemStatus.Running) {
			throw new Error('Sweep already in progress');
		}
		const frequencies = config.frequencies || [{ value: config.centerFrequency, unit: 'Hz' }];
		const success = await this.startCycle(frequencies, config.cycleTime || 10000);
		if (!success) throw new Error('Failed to start sweep');
	}

	async startCycle(
		frequencies: Array<{ value: number; unit: string }>,
		cycleTime: number
	): Promise<boolean> {
		if (!this.isInitialized) {
			logWarn('Service not yet initialized, waiting...');
			let waitTime = 0;
			while (!this.isInitialized && waitTime < 10000) {
				await new Promise((resolve) => setTimeout(resolve, 500));
				waitTime += 500;
			}
			if (!this.isInitialized) {
				logError('Service failed to initialize within 10 seconds');
				return false;
			}
		}

		await this.processManager.cleanup();
		await new Promise((resolve) => setTimeout(resolve, 1000));

		if (this.isRunning) {
			const processState = this.processManager.getProcessState();
			if (
				processState.isRunning &&
				processState.actualProcessPid &&
				this.processManager.isProcessAlive(processState.actualProcessPid)
			) {
				this._emitError('Sweep is already running', 'state_check');
				return false;
			} else {
				logWarn('Detected stale running state, resetting...');
				this.isRunning = false;
				this.status = { state: SystemStatus.Idle };
				this._emitEvent('status', this.status);
			}
		}

		if (!frequencies || frequencies.length === 0) {
			this._emitError('No frequencies provided', 'input_validation');
			return false;
		}

		const acquireResult = await resourceManager.acquire('hackrf-sweep', HardwareDevice.HACKRF);
		if (!acquireResult.success) {
			this._emitError(
				`HackRF is in use by ${acquireResult.owner}. Stop it first.`,
				'resource_conflict'
			);
			return false;
		}

		try {
			const validatedFreqs = this.frequencyCycler.normalizeFrequencies(frequencies);
			if (validatedFreqs.length === 0) {
				this._emitError('No valid frequencies provided', 'frequency_validation');
				return false;
			}

			await forceCleanupExistingProcesses(this.processManager);
			await new Promise((resolve) => setTimeout(resolve, 2000));

			logInfo(
				'[SEARCH] Using auto_sweep.sh for device detection (supports HackRF and USRP B205 mini)...'
			);

			this.frequencyCycler.initializeCycling({
				frequencies: validatedFreqs,
				cycleTime: cycleTime || 10000,
				switchingTime: 1000
			});

			this.isRunning = true;
			this.errorTracker.resetErrorTracking();

			this.status = {
				state: SystemStatus.Running,
				currentFrequency: convertToHz(validatedFreqs[0].value, validatedFreqs[0].unit),
				sweepProgress: 0,
				totalSweeps: validatedFreqs.length,
				completedSweeps: 0,
				startTime: Date.now()
			};

			this._emitEvent('status', this.status);
			const currentCycleState = this.frequencyCycler.getCycleState();
			this._emitEvent('cycle_config', {
				frequencies: currentCycleState.frequencies,
				cycleTime: currentCycleState.cycleTime,
				totalCycleTime: currentCycleState.frequencies.length * currentCycleState.cycleTime,
				isCycling: currentCycleState.isCycling
			});

			try {
				await this._runNextFrequency();
				return true;
			} catch (runError: unknown) {
				const error = runError as Error;
				logError('[ERROR] Error in _runNextFrequency:', { error: error.message });
				if (error.stack) logError('Stack:', { stack: error.stack });
				return true;
			}
		} catch (error: unknown) {
			const err = error as Error;
			this._emitError(`Failed to start cycle: ${err.message}`, 'cycle_startup', err);
			return false;
		}
	}

	async stopSweep(): Promise<void> {
		logInfo('[STOP] Stopping sweep... Current state:', { state: this.status.state });
		if (this.status.state === SystemStatus.Idle) {
			logInfo('Sweep already stopped');
			return;
		}

		this.status.state = SystemStatus.Stopping;
		this._emitEvent('status', this.status);

		this.frequencyCycler.stopCycling();
		this.isRunning = false;
		this.frequencyCycler.clearAllTimers();

		const processState = this.processManager.getProcessState();
		await this.processManager.stopProcess(processState);

		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		this.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.status);
		this._emitEvent('status_change', { status: 'stopped' });

		await resourceManager.release('hackrf-sweep', HardwareDevice.HACKRF);

		setTimeout(() => {
			this._emitEvent('status', { state: SystemStatus.Idle });
		}, 100);

		logInfo('Sweep stopped successfully');
	}

	async emergencyStop(): Promise<void> {
		logWarn('[ALERT] Emergency stop initiated');
		this.isRunning = false;

		this.frequencyCycler.emergencyStop();
		await this.processManager.forceKillProcess();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		this.cyclingHealth.status = SystemStatus.Idle;
		this.cyclingHealth.processHealth = 'stopped';
		this.cyclingHealth.lastDataReceived = null;

		this.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.status);
		this._emitEvent('status_change', { status: 'emergency_stopped' });
		logWarn('[ALERT] Emergency stop completed');
	}

	async forceCleanup(): Promise<void> {
		await forceCleanupExistingProcesses(this.processManager);
		this.status = { state: SystemStatus.Idle };
	}

	getStatus(): SweepStatus {
		return { ...this.status };
	}

	async checkHealth(): Promise<HackRFHealth> {
		const check = await this._testHackrfAvailability();
		return {
			connected: check.available,
			deviceInfo: check.deviceInfo,
			error: check.available ? undefined : check.reason,
			lastUpdate: Date.now()
		};
	}

	private async _runNextFrequency(): Promise<void> {
		if (!this.isRunning) return;

		const cycleState = this.frequencyCycler.getCycleState();
		if (!cycleState.currentFrequency) return;

		try {
			await this._startSweepProcess(cycleState.currentFrequency);
			this.errorTracker.recordSuccess();

			if (cycleState.isCycling && cycleState.frequencyCount > 1) {
				this.frequencyCycler.startCycleTimer(() => {
					this._cycleToNextFrequency().catch((error) => {
						logError('Error cycling to next frequency', {
							error: error instanceof Error ? error.message : String(error)
						});
					});
				});
			}
		} catch (error: unknown) {
			const errorAnalysis = this.errorTracker.recordError(error as Error, {
				frequency: cycleState.currentFrequency?.value,
				operation: 'start_sweep'
			});
			logError('[ERROR] Error starting sweep process:', {
				error: (error as Error).message,
				analysis: errorAnalysis
			});
			await this._handleSweepError(error as Error, cycleState.currentFrequency);
		}
	}

	private async _cycleToNextFrequency(): Promise<void> {
		const cycleState = this.frequencyCycler.getCycleState();
		if (!cycleState.isCycling || !this.isRunning) return;

		await this.frequencyCycler.cycleToNext(async (nextFreq) => {
			this._emitEvent('status_change', { status: 'switching', nextFrequency: nextFreq });
		});

		const processState = this.processManager.getProcessState();
		await this.processManager.stopProcess(processState);

		this.frequencyCycler.startSwitchTimer(() => {
			this._runNextFrequency().catch((error) => {
				logError('Error running next frequency', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		});
	}

	private async _startSweepProcess(frequency: { value: number; unit: string }): Promise<void> {
		try {
			const centerFreqMHz = convertToMHz(frequency.value, frequency.unit);
			const rangeMHz = 10;
			const freqMinMHz = centerFreqMHz - rangeMHz;
			const freqMaxMHz = centerFreqMHz + rangeMHz;

			if (freqMinMHz < 1 || freqMaxMHz > 7250) {
				throw new Error(`Frequency ${centerFreqMHz} MHz out of range (1-7250 MHz)`);
			}

			let vgaGain = '20';
			let lnaGain = '32';
			if (centerFreqMHz > 5000) {
				vgaGain = '30';
				lnaGain = '40';
			}

			const args = [
				'-f',
				`${Math.floor(freqMinMHz)}:${Math.ceil(freqMaxMHz)}`,
				'-g',
				vgaGain,
				'-l',
				lnaGain,
				'-w',
				'20000',
				'-n'
			];

			logInfo(`[START] Starting hackrf_sweep for ${centerFreqMHz} MHz`);
			logInfo(`[INFO] Command: hackrf_sweep ${args.join(' ')}`);

			this.bufferManager.clearBuffer();

			const handleStdout = (data: Buffer) => {
				this.bufferManager.processDataChunk(data, (parsedLine) => {
					if (parsedLine.isValid && parsedLine.data) {
						this._handleSpectrumData(parsedLine.data, frequency);
					} else if (parsedLine.parseError) {
						logWarn(
							'Failed to parse spectrum line',
							{
								error: parsedLine.parseError,
								line: parsedLine.rawLine.substring(0, 100)
							},
							'sweep-parse-error'
						);
					}
				});
			};

			const handleStderr = (data: Buffer) => {
				const message = data.toString().trim();
				logWarn('Process stderr', { message });
				if (isCriticalError(message)) {
					this.errorTracker.recordError(message, {
						frequency: frequency.value,
						operation: 'sweep_process'
					});
				}
			};

			this.processManager.setEventHandlers({
				onStdout: handleStdout,
				onStderr: handleStderr,
				onExit: (code: number | null, signal: string | null) => {
					logInfo('Process exited', { code, signal });
					this._handleProcessExit(code, signal);
				}
			});

			await this.processManager.spawnSweepProcess(args, {
				detached: false,
				stdio: ['ignore', 'pipe', 'pipe'],
				startupTimeoutMs: 5000
			});

			logInfo('[OK] HackRF sweep process started successfully', {
				centerFreq: `${frequency.value} ${frequency.unit}`,
				range: `${freqMinMHz} - ${freqMaxMHz} MHz`
			});
		} catch (error) {
			const analysis = this.errorTracker.recordError(error as Error, {
				frequency: frequency.value,
				operation: 'start_process'
			});
			logError('Failed to start sweep process', {
				error: error instanceof Error ? error.message : String(error),
				analysis
			});
			throw error;
		}
	}

	private _handleSpectrumData(
		data: SpectrumData,
		frequency: { value: number; unit: string }
	): void {
		try {
			const validation = this.bufferManager.validateSpectrumData(data);
			if (!validation.isValid) {
				logWarn(
					'Invalid spectrum data received',
					{ issues: validation.issues },
					'invalid-spectrum'
				);
				return;
			}
			this.cyclingHealth.lastDataReceived = new Date();
			this._emitEvent('spectrum_data', { frequency, data, timestamp: data.timestamp });
			if (this.cyclingHealth.processHealth !== 'running') {
				this.cyclingHealth.processHealth = 'running';
				this._emitEvent('status_change', { status: 'running' });
			}
		} catch (error) {
			logError('Error handling spectrum data', {
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	private _handleProcessExit(code: number | null, signal: string | null): void {
		this.cyclingHealth.processHealth = 'stopped';
		const exitAnalysis = this.errorTracker.recordError(
			`Process exited with code ${code}, signal ${signal}`,
			{ operation: 'process_exit' }
		);

		logInfo('Process exit handled by services', {
			code,
			signal,
			analysis: exitAnalysis,
			wasRunning: this.isRunning
		});

		this.processManager.cleanup();
		this._clearMonitoring();

		const cycleState = this.frequencyCycler.getCycleState();
		if (this.isRunning && !cycleState.inFrequencyTransition) {
			this._emitError(
				`HackRF process terminated unexpectedly: ${exitAnalysis.recommendedAction}`,
				'process_died'
			);
			if (this.errorTracker.shouldAttemptRecovery()) {
				performRecovery(
					this._getHealthContext(),
					`Process died: ${exitAnalysis.recommendedAction}`
				).catch((error) => {
					logError('Error performing recovery', {
						error: error instanceof Error ? error.message : String(error)
					});
				});
			}
		}
	}

	private _clearMonitoring(): void {
		if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
		logInfo('[CLEANUP] Monitoring timers cleared');
	}

	private async _handleSweepError(
		error: Error,
		frequency: { value: number; unit: string }
	): Promise<void> {
		const errorAnalysis = this.errorTracker.recordError(error, {
			frequency: frequency.value,
			operation: 'sweep_error'
		});

		logError('Sweep error analyzed by ErrorTracker', {
			error: error.message,
			frequency,
			analysis: errorAnalysis
		});

		if (this.errorTracker.shouldBlacklistFrequency(frequency.value)) {
			this.frequencyCycler.blacklistFrequency(frequency);
			logWarn('Frequency blacklisted by ErrorTracker', { frequency });
		}

		this._emitError(error.message, 'sweep_error', error);

		if (
			this.errorTracker.hasMaxConsecutiveErrors() ||
			this.errorTracker.hasMaxFailuresPerMinute()
		) {
			logError('ErrorTracker recommends stopping sweep', {
				analysis: errorAnalysis,
				recommendedAction: errorAnalysis.recommendedAction
			});
			await this.stopSweep();
		}
	}

	private _testHackrfAvailability(): Promise<{
		available: boolean;
		reason: string;
		deviceInfo?: string;
	}> {
		return new Promise((resolve) => {
			execFile('/usr/bin/timeout', ['3', 'hackrf_info'], (error, stdout, stderr) => {
				if (error) {
					resolve({
						available: false,
						reason:
							error.code === 124
								? 'Device check timeout'
								: `Device check failed: ${error.message}`
					});
				} else if (stderr.includes('Resource busy')) {
					resolve({ available: false, reason: 'Device busy' });
				} else if (stderr.includes('No HackRF boards found')) {
					resolve({ available: false, reason: 'No HackRF found' });
				} else if (stdout.includes('Serial number')) {
					const deviceInfo = stdout
						.split('\n')
						.filter((line) => line.trim())
						.join(', ');
					resolve({ available: true, reason: 'HackRF detected', deviceInfo });
				} else {
					resolve({ available: false, reason: 'Unknown error' });
				}
			});
		});
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
		if (this.processMonitorInterval) clearInterval(this.processMonitorInterval);
		if (this.dataTimeoutTimer) clearTimeout(this.dataTimeoutTimer);
		await this.emergencyStop();
	}
}

// Singleton instance — persisted via globalThis to survive Vite HMR reloads.
const SWEEP_MANAGER_KEY = '__argos_sweepManager';
export const sweepManager: SweepManager =
	((globalThis as Record<string, unknown>)[SWEEP_MANAGER_KEY] as SweepManager) ??
	(((globalThis as Record<string, unknown>)[SWEEP_MANAGER_KEY] =
		new SweepManager()) as SweepManager);

/** Returns the singleton SweepManager instance for controlling HackRF spectrum sweeps. */
export function getSweepManager(): SweepManager {
	return sweepManager;
}
