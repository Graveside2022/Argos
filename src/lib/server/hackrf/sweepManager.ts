import type { SweepConfig, SweepStatus, SpectrumData, HackRFHealth } from './types';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { logInfo, logError, logWarn } from '$lib/utils/logger';
import { SystemStatus } from '$lib/types/enums';

// Import modular services
import { ProcessManager } from '$lib/services/hackrf/sweep-manager/process/ProcessManager';
import { FrequencyCycler } from '$lib/services/hackrf/sweep-manager/frequency/FrequencyCycler';
import { BufferManager } from '$lib/services/hackrf/sweep-manager/buffer/BufferManager';
import { ErrorTracker } from '$lib/services/hackrf/sweep-manager/error/ErrorTracker';

/**
 * Manages HackRF sweep operations using modular service architecture
 * Refactored from monolithic implementation to focused service components
 */
export class SweepManager extends EventEmitter {
	// State management
	private status: SweepStatus = { state: SystemStatus.Idle };
	private isRunning = false;
	private isInitialized = false;

	// Modular services
	private processManager: ProcessManager;
	private frequencyCycler: FrequencyCycler;
	private bufferManager: BufferManager;
	private errorTracker: ErrorTracker;

	// Health monitoring
	private cyclingHealth = {
		status: SystemStatus.Idle,
		processHealth: 'unknown' as string,
		processStartupPhase: 'none' as string,
		lastSwitchTime: null as Date | null,
		lastDataReceived: null as Date | null,
		recovery: {
			recoveryAttempts: 0,
			maxRecoveryAttempts: 3,
			lastRecoveryAttempt: null as Date | null,
			isRecovering: false
		}
	};

	private healthMonitorInterval: ReturnType<typeof setInterval>;

	// SSE emitter reference
	private sseEmitter: ((event: string, data: unknown) => void) | null = null;

	constructor() {
		super();

		// Initialize modular services
		this.processManager = new ProcessManager();
		this.frequencyCycler = new FrequencyCycler();
		this.bufferManager = new BufferManager();
		this.errorTracker = new ErrorTracker();

		// Start health monitoring with longer interval
		this.healthMonitorInterval = setInterval(() => {
			this._performHealthCheck().catch((error) => {
				logError('Error performing health check', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}, 30000); // Check every 30 seconds instead of 5

		// Perform startup validation
		this._performStartupValidation();
	}

	/**
	 * Set SSE emitter for sending events to clients
	 */
	setSseEmitter(emitter: ((event: string, data: unknown) => void) | null): void {
		this.sseEmitter = emitter;
	}

	/**
	 * Perform startup state validation
	 */
	private _performStartupValidation(): void {
		logInfo('🔍 SweepManager: Performing startup state validation...');

		// Reset all state
		this.isRunning = false;

		// Reset modular services
		this.processManager.cleanup();
		this.frequencyCycler.resetCycling();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		// Reset health status using error tracker device state
		const _deviceState = this.errorTracker.getDeviceState();
		this.cyclingHealth.status = SystemStatus.Idle;
		this.cyclingHealth.processHealth = 'stopped';
		this.cyclingHealth.lastDataReceived = null;
		const recoveryStatus = this.errorTracker.getRecoveryStatus();
		this.cyclingHealth.recovery.recoveryAttempts = recoveryStatus.recoveryAttempts;
		this.cyclingHealth.recovery.lastRecoveryAttempt = recoveryStatus.lastRecoveryAttempt;
		this.cyclingHealth.recovery.isRecovering = recoveryStatus.isRecovering;

		this.isInitialized = true;
		logInfo('✅ SweepManager startup validation complete');
	}

	/**
	 * Perform health check
	 */
	private async _performHealthCheck(): Promise<void> {
		// Only perform health checks if we're actually running
		const processState = this.processManager.getProcessState();
		if (!this.isRunning || !processState.isRunning) {
			return;
		}

		const now = Date.now();
		const cycleState = this.frequencyCycler.getCycleState();
		const _bufferStats = this.bufferManager.getBufferStats();
		const recoveryStatus = this.errorTracker.getRecoveryStatus();

		// Log health check details
		logInfo('🏥 Health check:', {
			isRunning: this.isRunning,
			hasSweepProcess: processState.isRunning,
			pid: processState.processId,
			inFrequencyTransition: cycleState.inFrequencyTransition,
			isCycling: cycleState.isCycling,
			lastDataReceived: this.cyclingHealth.lastDataReceived?.toISOString(),
			processStartTime: processState.processStartTime
				? new Date(processState.processStartTime).toISOString()
				: null,
			recoveryAttempts: recoveryStatus.recoveryAttempts,
			isRecovering: recoveryStatus.isRecovering
		});

		// Check system memory periodically
		try {
			const memInfo = await this._checkSystemMemory();
			logInfo(
				`💾 Memory: ${memInfo.availablePercent}% available (${memInfo.availableMB}MB / ${memInfo.totalMB}MB)`
			);
			if (memInfo.availablePercent < 10) {
				logWarn(`⚠️ Low memory: ${memInfo.availablePercent}% available`);
			}
		} catch (e) {
			logError('Failed to check memory:', { error: (e as Error).message });
		}

		// Check if we're already recovering
		if (this.cyclingHealth.recovery.isRecovering) {
			logInfo('⏳ Already in recovery, skipping health check');
			return;
		}

		// Check multiple health indicators
		let needsRecovery = false;
		let reason = '';

		// 1. Check if process has been running too long without data
		if (this.cyclingHealth.lastDataReceived) {
			const timeSinceData = now - this.cyclingHealth.lastDataReceived.getTime();
			logInfo(`📊 Time since last data: ${Math.round(timeSinceData / 1000)}s`);
			if (timeSinceData > 7200000) {
				// 2 hours without data (changed from 2 minutes for long-term monitoring)
				needsRecovery = true;
				reason = 'No data received for 2 hours';
			}
		} else if (processState.processStartTime && now - processState.processStartTime > 60000) {
			// No data ever received and process has been running for 60 seconds
			const runTime = Math.round((now - processState.processStartTime) / 1000);
			logWarn(`⏱️ Process running for ${runTime}s with no data`);
			needsRecovery = true;
			reason = 'No initial data received';
		}

		// 2. Check if process is still alive using process manager
		if (processState.isRunning && processState.processId) {
			const isAlive = this.processManager.isProcessAlive();
			if (isAlive) {
				logInfo(`✅ Process ${processState.processId} is still alive`);
			} else {
				// Process no longer exists or cannot be signaled
				needsRecovery = true;
				reason = 'Process no longer exists';
			}
		}

		// Perform recovery if needed
		if (needsRecovery) {
			logWarn(`⚠️ Health check failed: ${reason}`);
			this.cyclingHealth.processHealth = 'unhealthy';
			await this._performRecovery(reason);
		} else if (this.cyclingHealth.lastDataReceived) {
			this.cyclingHealth.processHealth = 'healthy';
		}
	}

	/**
	 * Start a new sweep operation
	 */
	async startSweep(config: SweepConfig): Promise<void> {
		if (this.status.state === SystemStatus.Running) {
			throw new Error('Sweep already in progress');
		}

		// Convert single frequency config to multi-frequency format
		const frequencies = config.frequencies || [
			{
				value: config.centerFrequency,
				unit: 'Hz'
			}
		];

		// Start cycling with configured parameters
		const success = await this.startCycle(frequencies, config.cycleTime || 10000);
		if (!success) {
			throw new Error('Failed to start sweep');
		}
	}

	/**
	 * Start frequency cycling
	 */
	async startCycle(
		frequencies: Array<{ value: number; unit: string }>,
		cycleTime: number
	): Promise<boolean> {
		// Verify service is initialized
		if (!this.isInitialized) {
			logWarn('Service not yet initialized');
			return false;
		}

		// Force cleanup existing processes using process manager
		await this.processManager.cleanup();

		// Additional startup delay
		await new Promise((resolve) => setTimeout(resolve, 1000));

		if (this.isRunning) {
			this._emitError('Sweep is already running', 'state_check');
			return false;
		}

		if (!frequencies || frequencies.length === 0) {
			this._emitError('No frequencies provided', 'input_validation');
			return false;
		}

		try {
			// Normalize frequencies using frequency cycler
			const validatedFreqs = this.frequencyCycler.normalizeFrequencies(frequencies);

			if (validatedFreqs.length === 0) {
				this._emitError('No valid frequencies provided', 'frequency_validation');
				return false;
			}

			// Check device availability
			logInfo('🔍 Checking HackRF device availability...');
			const deviceCheck = await this._testHackrfAvailability();
			if (!deviceCheck.available) {
				this._emitError(`HackRF not available: ${deviceCheck.reason}`, 'device_check');
				return false;
			}

			// Initialize cycling using frequency cycler service
			this.frequencyCycler.initializeCycling({
				frequencies: validatedFreqs,
				cycleTime: cycleTime || 10000
			});

			this.isRunning = true;
			this.errorTracker.resetErrorTracking();

			// Update status
			this.status = {
				state: SystemStatus.Running,
				currentFrequency: this._convertToHz(
					validatedFreqs[0].value,
					validatedFreqs[0].unit
				),
				sweepProgress: 0,
				totalSweeps: validatedFreqs.length,
				completedSweeps: 0,
				startTime: Date.now()
			};

			// Emit events
			this._emitEvent('status', this.status);
			const currentCycleState = this.frequencyCycler.getCycleState();
			this._emitEvent('cycle_config', {
				frequencies: currentCycleState.frequencies,
				cycleTime: currentCycleState.cycleTime,
				totalCycleTime: currentCycleState.frequencies.length * currentCycleState.cycleTime,
				isCycling: currentCycleState.isCycling
			});

			// Start the first frequency
			try {
				await this._runNextFrequency();
				return true;
			} catch (runError: unknown) {
				const error = runError as Error;
				logError('❌ Error in _runNextFrequency:', { error: error.message });
				if (error.stack) {
					logError('Stack:', { stack: error.stack });
				}

				// Don't fail the whole cycle start, just log the error
				// The sweep manager status is already set to running
				return true;
			}
		} catch (error: unknown) {
			const err = error as Error;
			this._emitError(`Failed to start cycle: ${err.message}`, 'cycle_startup', err);
			return false;
		}
	}

	/**
	 * Stop the current sweep operation
	 */
	async stopSweep(): Promise<void> {
		logInfo('🛑 Stopping sweep... Current state:', { state: this.status.state });

		// Allow stopping from any state except idle
		if (this.status.state === SystemStatus.Idle) {
			logInfo('Sweep already stopped');
			return;
		}

		this.status.state = SystemStatus.Stopping;
		this._emitEvent('status', this.status);

		// Stop cycling first using frequency cycler
		this.frequencyCycler.stopCycling();
		this.isRunning = false;

		// Clear timers from frequency cycler
		this.frequencyCycler.clearAllTimers();

		// Stop the sweep process using process manager
		await this.processManager.stopProcess();

		// Clear buffer and reset services
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		// Update status
		this.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.status);
		this._emitEvent('status_change', { status: 'stopped' });

		// Force emit idle status to ensure UI updates
		setTimeout(() => {
			this._emitEvent('status', { state: SystemStatus.Idle });
		}, 100);

		logInfo('Sweep stopped successfully');
	}

	/**
	 * Emergency stop - forcefully terminate all operations
	 */
	async emergencyStop(): Promise<void> {
		logWarn('🚨 Emergency stop initiated');

		// Force stop everything immediately
		this.isRunning = false;

		// Emergency stop all services
		this.frequencyCycler.emergencyStop();
		await this.processManager.forceKillProcess();
		this.bufferManager.clearBuffer();
		this.errorTracker.resetErrorTracking();

		// Clear any remaining health monitoring state
		this.cyclingHealth.status = SystemStatus.Idle;
		this.cyclingHealth.processHealth = 'stopped';
		this.cyclingHealth.lastDataReceived = null;

		// Update status
		this.status = { state: SystemStatus.Idle };
		this._emitEvent('status', this.status);
		this._emitEvent('status_change', { status: 'emergency_stopped' });

		logWarn('🚨 Emergency stop completed');
	}

	/**
	 * Force cleanup of any lingering processes
	 */
	async forceCleanup(): Promise<void> {
		await this._forceCleanupExistingProcesses();
		this.status = { state: SystemStatus.Idle };
	}

	/**
	 * Get current sweep status
	 */
	getStatus(): SweepStatus {
		return { ...this.status };
	}

	/**
	 * Check HackRF device health
	 */
	async checkHealth(): Promise<HackRFHealth> {
		const check = await this._testHackrfAvailability();
		return {
			connected: check.available,
			deviceInfo: check.deviceInfo,
			error: check.available ? undefined : check.reason,
			lastUpdate: Date.now()
		};
	}

	/**
	 * Run the next frequency in the cycle
	 */
	private async _runNextFrequency(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		const cycleState = this.frequencyCycler.getCycleState();
		if (!cycleState.currentFrequency) {
			return;
		}

		try {
			// Start sweep for this frequency using process manager
			await this._startSweepProcess(cycleState.currentFrequency);

			// Reset error tracking on successful start
			this.errorTracker.recordSuccess();

			// If cycling, set up timer for next frequency
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
			logError('❌ Error starting sweep process:', { 
				error: (error as Error).message,
				analysis: errorAnalysis
			});
			await this._handleSweepError(error as Error, cycleState.currentFrequency);
		}
	}

	/**
	 * Cycle to the next frequency
	 */
	private async _cycleToNextFrequency(): Promise<void> {
		const cycleState = this.frequencyCycler.getCycleState();
		if (!cycleState.isCycling || !this.isRunning) {
			return;
		}

		// Move to next frequency using frequency cycler
		const nextFreq = this.frequencyCycler.cycleToNext();

		// Emit switching status
		this._emitEvent('status_change', {
			status: 'switching',
			nextFrequency: nextFreq
		});

		// Stop current process using process manager
		await this.processManager.stopProcess();

		// Wait before switching using frequency cycler
		this.frequencyCycler.startSwitchTimer(() => {
			this._runNextFrequency().catch((error) => {
				logError('Error running next frequency', {
					error: error instanceof Error ? error.message : String(error)
				});
			});
		});
	}

	/**
	 * Start the hackrf_sweep process using ProcessManager
	 */
	private async _startSweepProcess(frequency: { value: number; unit: string }): Promise<void> {
		try {
			// Convert frequency to MHz
			const centerFreqMHz = this._convertToMHz(frequency.value, frequency.unit);
			const rangeMHz = 10; // Default 10 MHz range
			const freqMinMHz = centerFreqMHz - rangeMHz;
			const freqMaxMHz = centerFreqMHz + rangeMHz;

			// Validate range
			if (freqMinMHz < 1 || freqMaxMHz > 7250) {
				throw new Error(`Frequency ${centerFreqMHz} MHz out of range (1-7250 MHz)`);
			}

			// Prepare arguments
			const args = [
				'-f',
				`${Math.floor(freqMinMHz)}:${Math.ceil(freqMaxMHz)}`,
				'-g',
				'20',
				'-l',
				'32',
				'-w',
				'20000' // 20kHz bin width
			];

			logInfo(`🚀 Starting hackrf_sweep for ${centerFreqMHz} MHz`);
			logInfo(`📋 Command: hackrf_sweep ${args.join(' ')}`);

			// Spawn process using ProcessManager
			const _processState = await this.processManager.spawnSweepProcess(args, {
				detached: true,
				stdio: ['ignore', 'pipe', 'pipe'],
				startupTimeoutMs: 5000
			});

			// Set up data processing using BufferManager
			this.bufferManager.clearBuffer(); // Clear any old data

			// Handle stdout data
			const handleStdout = (data: Buffer) => {
				this.bufferManager.processDataChunk(data, (parsedLine) => {
					if (parsedLine.isValid && parsedLine.data) {
						this._handleSpectrumData(parsedLine.data, frequency);
					} else if (parsedLine.parseError) {
						logWarn('Failed to parse line', { 
							error: parsedLine.parseError,
							line: parsedLine.rawLine.substring(0, 100)
						});
					}
				});
			};

			// Handle stderr data
			const handleStderr = (data: Buffer) => {
				const message = data.toString().trim();
				logWarn('Process stderr', { message });

				// Analyze error using ErrorTracker
				if (this._isCriticalError(message)) {
					this.errorTracker.recordError(message, {
						frequency: frequency.value,
						operation: 'sweep_process'
					});
				}
			};

			// Set up process event handlers
			this.processManager.setEventHandlers({
				onStdout: handleStdout,
				onStderr: handleStderr,
				onExit: (code, signal) => {
					logInfo('Process exited', { code, signal });
					this._handleProcessExit(code, signal);
				}
			});

			logInfo('✅ HackRF sweep process started successfully', {
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

	/**
	 * Handle spectrum data from parsed line
	 */
	private _handleSpectrumData(data: SpectrumData, frequency: { value: number; unit: string }): void {
		try {
			// Validate data quality
			const validation = this.bufferManager.validateSpectrumData(data);
			if (!validation.isValid) {
				logWarn('Invalid spectrum data received', { issues: validation.issues });
				return;
			}

			// Update last data received time
			this.cyclingHealth.lastDataReceived = new Date();

			// Emit spectrum data
			this._emitEvent('spectrum_data', {
				frequency: frequency,
				data: data,
				timestamp: data.timestamp
			});

			// Update status if needed
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

	/**
	 * Handle process exit using ProcessManager
	 */
	private _handleProcessExit(code: number | null, signal: string | null): void {
		// Update process health through process manager
		this.cyclingHealth.processHealth = 'stopped';

		// Analyze the exit using ErrorTracker
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

		// Use ProcessManager to handle cleanup
		this.processManager.cleanup();

		// Clear any remaining timers and intervals
		this._clearMonitoring();

		// Check if we're in frequency transition using FrequencyCycler
		const cycleState = this.frequencyCycler.getCycleState();
		if (this.isRunning && !cycleState.inFrequencyTransition) {
			this._emitError(
				`HackRF process terminated unexpectedly: ${exitAnalysis.recommendedAction}`,
				'process_died'
			);

			// Use ErrorTracker to determine if recovery should be attempted
			if (this.errorTracker.shouldAttemptRecovery()) {
				this._performRecovery(`Process died: ${exitAnalysis.recommendedAction}`).catch(
					(error) => {
						logError('Error performing recovery', {
							error: error instanceof Error ? error.message : String(error)
						});
					}
				);
			}
		}
	}

	/**
	 * Clear all monitoring timers and intervals
	 */
	private _clearMonitoring(): void {
		// Clear any remaining health check intervals
		if (this.healthMonitorInterval) {
			clearInterval(this.healthMonitorInterval);
		}
		logInfo('🧹 Monitoring timers cleared');
	}

	/**
	 * Stop the sweep process using ProcessManager
	 */
	private async _stopSweepProcess(): Promise<void> {
		// Use ProcessManager for all process operations
		await this.processManager.stopProcess();
		
		// Clear monitoring timers
		this._clearMonitoring();
		
		logInfo('Sweep process stopped via ProcessManager');
	}

	/**
	 * Handle process output line using BufferManager and FrequencyCycler
	 */
	private _handleProcessOutputLine(
		line: string,
		frequency: { value: number; unit: string }
	): void {
		try {
			// Parse using BufferManager's parseSpectrumLine method
			const parsedLine = this.bufferManager.parseSpectrumLine(line);
			if (!parsedLine.isValid || !parsedLine.data) return;

			// Get cycle state from FrequencyCycler
			const cycleState = this.frequencyCycler.getCycleState();

			// Create spectrum data with cycle information
			const spectrumData: SpectrumData = {
				...parsedLine.data,
				metadata: {
					...parsedLine.data.metadata,
					targetFrequency: frequency,
					currentIndex: cycleState.currentIndex,
					totalFrequencies: cycleState.frequencyCount
				}
			};

			// Update last data received time
			this.cyclingHealth.lastDataReceived = new Date();

			// Emit data
			if (this.sseEmitter) {
				this.sseEmitter('sweep_data', spectrumData);
			}

			this.emit('spectrum', spectrumData);
		} catch (error) {
			logError('Error processing output line', { error, line }, 'output-processing-error');
		}
	}

	/**
	 * Parse hackrf_sweep output line using BufferManager
	 */
	private _parseHackrfOutput(line: string): {
		date: string;
		time: string;
		frequencyRange: {
			low: number;
			high: number;
			center: number;
		};
		binWidth: number;
		numSamples: number;
		maxDb: number;
		signalStrength: string;
		dbValues: number[];
		frequency: number;
		unit: string;
		db: number;
		peakBinIndex: number;
	} | null {
		// Use BufferManager for parsing
		const parsedLine = this.bufferManager.parseSpectrumLine(line);
		if (!parsedLine.isValid || !parsedLine.data) {
			return null;
		}

		// Convert BufferManager format to legacy format for compatibility
		const data = parsedLine.data;
		return {
			date: new Date(data.timestamp).toISOString().split('T')[0],
			time: new Date(data.timestamp).toISOString().split('T')[1],
			frequencyRange: data.metadata?.frequencyRange || {
				low: data.frequency * 1000000,
				high: data.frequency * 1000000,
				center: data.frequency * 1000000
			},
			binWidth: data.metadata?.binWidth || 0,
			numSamples: data.binData?.length || 0,
			maxDb: data.power,
			signalStrength: data.metadata?.signalStrength || this._getSignalStrength(data.power),
			dbValues: data.binData || [],
			frequency: data.frequency,
			unit: data.unit,
			db: data.power,
			peakBinIndex: 0 // BufferManager handles peak detection
		};
	}

	/**
	 * Get signal strength category
	 */
	private _getSignalStrength(dB: number): string {
		if (dB < -90) return 'No Signal';
		if (dB >= -90 && dB < -70) return 'Very Weak';
		if (dB >= -70 && dB < -50) return 'Weak';
		if (dB >= -50 && dB < -30) return 'Moderate';
		if (dB >= -30 && dB < -10) return 'Strong';
		return 'Very Strong';
	}

	/**
	 * Test HackRF availability
	 */
	private async _testHackrfAvailability(): Promise<{
		available: boolean;
		reason: string;
		deviceInfo?: string;
	}> {
		return new Promise((resolve) => {
			exec('timeout 3 hackrf_info', (error, stdout, stderr) => {
				if (error) {
					if (error.code === 124) {
						resolve({ available: false, reason: 'Device check timeout' });
					} else {
						resolve({
							available: false,
							reason: `Device check failed: ${error.message}`
						});
					}
				} else if (stderr.includes('Resource busy')) {
					resolve({ available: false, reason: 'Device busy' });
				} else if (stderr.includes('No HackRF boards found')) {
					resolve({ available: false, reason: 'No HackRF found' });
				} else if (stdout.includes('Serial number')) {
					// Extract device info
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

	/**
	 * Force cleanup existing processes using ProcessManager
	 */
	private async _forceCleanupExistingProcesses(): Promise<void> {
		logInfo('Force cleaning up existing HackRF processes', {}, 'hackrf-cleanup-start');

		try {
			const processState = this.processManager.getProcessState();
			
			// Only kill hackrf_sweep processes that aren't ours
			if (processState.isRunning && processState.pgid) {
				// Kill all hackrf_sweep processes except our current process group
				await new Promise<void>((resolve) => {
					exec(
						`pgrep -x hackrf_sweep | grep -v "^${processState.pgid}$" | xargs -r kill -9`,
						() => resolve()
					);
				});
			} else {
				// No current process, safe to kill all
				await new Promise<void>((resolve) => {
					exec('pkill -9 -x hackrf_sweep', () => resolve());
				});
			}

			// Kill any hackrf_info processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f hackrf_info', () => resolve());
			});

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 1000));

			logInfo('Cleanup complete', {}, 'hackrf-cleanup-complete');
		} catch (error) {
			logError('Cleanup failed', { error }, 'hackrf-cleanup-failed');
		}
	}

	/**
	 * Check if error is critical startup error
	 */
	private _isCriticalStartupError(message: string): boolean {
		const criticalErrors = [
			'No HackRF boards found',
			'hackrf_open() failed',
			'Resource busy',
			'Permission denied',
			'libusb_open() failed',
			'USB error',
			'hackrf_is_streaming() failed',
			'hackrf_start_rx() failed'
		];

		return criticalErrors.some((error) => message.toLowerCase().includes(error.toLowerCase()));
	}

	/**
	 * Normalize frequencies to standard format
	 */
	private _normalizeFrequencies(
		frequencies: (number | { frequency?: number; value?: number; unit?: string })[]
	): Array<{ value: number; unit: string }> {
		return frequencies
			.map((freq) => {
				if (typeof freq === 'number') {
					return { value: freq, unit: 'MHz' };
				} else if (freq.frequency !== undefined) {
					return { value: freq.frequency, unit: freq.unit || 'MHz' };
				} else if (freq.value !== undefined) {
					return { value: freq.value, unit: freq.unit || 'MHz' };
				}
				throw new Error('Invalid frequency format');
			})
			.filter((f) => f.value > 0);
	}

	/**
	 * Convert frequency to Hz
	 */
	private _convertToHz(value: number, unit: string): number {
		switch (unit.toLowerCase()) {
			case 'hz':
				return value;
			case 'khz':
				return value * 1000;
			case 'mhz':
				return value * 1000000;
			case 'ghz':
				return value * 1000000000;
			default:
				return value * 1000000; // Default to MHz
		}
	}

	/**
	 * Convert frequency to MHz
	 */
	private _convertToMHz(value: number, unit: string): number {
		switch (unit.toLowerCase()) {
			case 'hz':
				return value / 1000000;
			case 'khz':
				return value / 1000;
			case 'mhz':
				return value;
			case 'ghz':
				return value * 1000;
			default:
				return value;
		}
	}

	/**
	 * Reset error tracking using ErrorTracker service
	 */
	private _resetErrorTracking(): void {
		// Use ErrorTracker service for error state management
		this.errorTracker.resetErrorTracking();
	}

	/**
	 * Handle sweep errors using ErrorTracker and FrequencyCycler
	 */
	private async _handleSweepError(error: Error, frequency: { value: number; unit: string }): Promise<void> {
		// Record error using ErrorTracker
		const errorAnalysis = this.errorTracker.recordError(error, {
			frequency: frequency.value,
			operation: 'sweep_error'
		});

		logError('Sweep error analyzed by ErrorTracker', { 
			error: error.message, 
			frequency, 
			analysis: errorAnalysis 
		});

		// Check if frequency should be blacklisted using FrequencyCycler
		if (errorAnalysis.frequencyErrorCount > 3) {
			this.frequencyCycler.blacklistFrequency(frequency);
			logWarn('Frequency blacklisted by FrequencyCycler', { frequency });
		}

		// Emit error event
		this._emitError(error.message, 'sweep_error', error);

		// Check if we should stop using ErrorTracker
		if (!this.errorTracker.shouldContinueOperation()) {
			logError('ErrorTracker recommends stopping sweep', {
				analysis: errorAnalysis,
				recommendedAction: errorAnalysis.recommendedAction
			});
			await this.stopSweep();
		}
	}

	/**
	 * Emit event via SSE and EventEmitter
	 */
	private _emitEvent(event: string, data: unknown): void {
		if (this.sseEmitter) {
			try {
				this.sseEmitter(event, data);
			} catch (error) {
				// SSE connection might be closed, clear the emitter
				logWarn('SSE emitter error, clearing reference', { error });
				this.sseEmitter = null;
			}
		}
		// Only emit to EventEmitter if there are listeners
		if (this.listenerCount(event) > 0) {
			this.emit(event, data);
		}
	}

	/**
	 * Emit error event
	 */
	private _emitError(message: string, type: string, error?: Error): void {
		const errorData = {
			message,
			type,
			timestamp: new Date().toISOString(),
			details: error?.stack
		};

		this._emitEvent('error', errorData);
		logError(`❌ ${type}: ${message}`, { type, details: error?.stack });
	}

	/**
	 * Perform recovery operation using ErrorTracker and service-based recovery
	 */
	private async _performRecovery(reason: string): Promise<void> {
		// Use ErrorTracker to manage recovery attempts
		const recoveryStatus = this.errorTracker.getRecoveryStatus();
		
		logInfo('Recovery triggered via ErrorTracker', {
			reason,
			recoveryStatus
		});

		// Check if recovery should be attempted using ErrorTracker
		if (!this.errorTracker.shouldAttemptRecovery()) {
			logError('ErrorTracker recommends stopping recovery attempts');
			this._emitError('Max recovery attempts reached', 'recovery_failed');
			this.status = { state: SystemStatus.Stopping };
			this._emitEvent('status', this.status);
			await this.stopSweep();
			return;
		}

		// Start recovery using ErrorTracker
		this.errorTracker.startRecovery(reason);
		this.cyclingHealth.recovery.isRecovering = true;

		this._emitEvent('recovery_start', {
			reason,
			attempt: recoveryStatus.recoveryAttempts + 1,
			maxAttempts: 3
		});

		try {
			// Use ProcessManager for cleanup
			await this.processManager.forceKillProcess();
			await this.processManager.cleanup();

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Restart current frequency using FrequencyCycler
			const cycleState = this.frequencyCycler.getCycleState();
			if (cycleState.currentFrequency && this.isRunning) {
				await this._startSweepProcess(cycleState.currentFrequency);

				// Record successful recovery
				this.errorTracker.recordSuccess();
				
				logInfo('Recovery completed via services');
				this._emitEvent('recovery_complete', { reason });
			}
		} catch (error: unknown) {
			const err = error as Error;
			
			// Record recovery failure
			this.errorTracker.recordError(err, { operation: 'recovery' });
			
			logError('Recovery failed', { error: err, reason });
			this._emitError(`Recovery failed: ${err.message}`, 'recovery_error');
			await this.stopSweep();
		} finally {
			this.cyclingHealth.recovery.isRecovering = false;
		}
	}

	/**
	 * Start process monitoring using ProcessManager and BufferManager
	 */
	private _startProcessMonitoring(): void {
		// Clear any existing monitoring
		if (this.processMonitorInterval) {
			clearInterval(this.processMonitorInterval);
		}

		// Monitor process every 2 seconds
		this.processMonitorInterval = setInterval(() => {
			const processState = this.processManager.getProcessState();
			if (!processState.isRunning || !processState.pid) return;

			try {
				// Check if process is still alive using ProcessManager
				if (!this.processManager.isProcessAlive()) {
					logError(
						'Process monitor: Process no longer exists',
						{ pid: processState.pid },
						'process-dead'
					);
					// Process is dead, trigger exit handler
					this._handleProcessExit(null, 'UNKNOWN');
					return;
				}

				// Check buffer health using BufferManager
				const bufferStats = this.bufferManager.getBufferStats();
				if (bufferStats.sizeKB > bufferStats.maxSizeKB * 0.8) {
					logWarn(
						'Buffer size warning',
						{ bufferSizeKB: bufferStats.sizeKB },
						'buffer-size-warning'
					);
				}
			} catch (error) {
				logError(
					'Process monitor error',
					{ 
						pid: processState.pid,
						error: error instanceof Error ? error.message : String(error)
					},
					'process-monitor-error'
				);
			}
		}, 2000);

		// Set up data timeout monitoring
		this._resetDataTimeout();
	}

	/**
	 * Reset data timeout timer using service-based state management
	 */
	private _resetDataTimeout(): void {
		if (this.dataTimeoutTimer) {
			clearTimeout(this.dataTimeoutTimer);
		}

		// Set timeout for 120 seconds (increased from 90)
		this.dataTimeoutTimer = setTimeout(() => {
			const cycleState = this.frequencyCycler.getCycleState();
			const processState = this.processManager.getProcessState();
			
			if (this.isRunning && !cycleState.inFrequencyTransition) {
				logWarn(
					'No data received for 120 seconds',
					{
						lastDataReceived: this.cyclingHealth.lastDataReceived?.toISOString(),
						isRunning: this.isRunning,
						processRunning: processState.isRunning,
						pid: processState.pid,
						inFrequencyTransition: cycleState.inFrequencyTransition
					},
					'data-timeout'
				);
				this._performRecovery('No data timeout').catch((error) => {
					logError('Error performing recovery', {
						error: error instanceof Error ? error.message : String(error)
					});
				});
			}
		}, 120000); // 120 seconds timeout
	}

	/**
	 * Check system memory
	 */
	private async _checkSystemMemory(): Promise<{
		availablePercent: number;
		totalMB: number;
		availableMB: number;
	}> {
		return new Promise((resolve, reject) => {
			exec('free -m', (error, stdout) => {
				if (error) {
					reject(error);
					return;
				}

				const lines = stdout.trim().split('\n');
				const memLine = lines[1]; // "Mem:" line
				const parts = memLine.split(/\s+/);

				const totalMB = parseInt(parts[1]);
				const availableMB = parseInt(parts[6] || parts[3]); // Try "available" column first, then "free"
				const availablePercent = Math.round((availableMB / totalMB) * 100);

				resolve({ availablePercent, totalMB, availableMB });
			});
		});
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		// Stop health monitoring
		if (this.healthMonitorInterval) {
			clearInterval(this.healthMonitorInterval);
		}

		// Stop process monitoring
		if (this.processMonitorInterval) {
			clearInterval(this.processMonitorInterval);
		}

		// Clear data timeout
		if (this.dataTimeoutTimer) {
			clearTimeout(this.dataTimeoutTimer);
		}

		// Stop any running sweep
		await this.emergencyStop();
	}
}

// Singleton instance
export const sweepManager = new SweepManager();

// Export getter function for consistency
export function getSweepManager(): SweepManager {
	return sweepManager;
}
