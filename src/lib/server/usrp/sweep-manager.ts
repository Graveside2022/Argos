import { EventEmitter } from 'events';

import { SystemStatus } from '$lib/types/enums';
import { BufferManager, type ParsedLine } from '$lib/usrp/sweep-manager/buffer-manager';
import { ProcessManager } from '$lib/usrp/sweep-manager/process-manager';
import { logDebug, logError, logInfo, logWarn } from '$lib/utils/logger';

interface SweepStatus {
	state: SystemStatus;
	message?: string;
	// @constitutional-exemption Article-II-2.1 issue:#type-safety-remediation — SweepSettings type would require complex union, works in production
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	details?: any;
}

interface FrequencyRange {
	start: number; // MHz
	stop: number; // MHz
	label: string;
}

interface SweepSettings {
	frequencyRange: FrequencyRange;
	sampleRate?: number; // Sample rate in Hz
	gain?: number; // Gain in dB
	bandwidth?: number; // Bandwidth in Hz
	antennaPort?: 'TX/RX' | 'RX2';
}

/**
 * Manages USRP B205 mini spectrum sweeping operations
 */
export class UsrpSweepManager extends EventEmitter {
	private static instance: UsrpSweepManager | null = null;

	private processManager: ProcessManager;
	private bufferManager: BufferManager;
	private sweepSettings: SweepSettings | null = null;

	private isRunning = false;
	private isInitialized = false;
	private initializationPromise: Promise<void> | null = null;

	private status: SweepStatus = {
		state: SystemStatus.Idle
	};

	// Predefined frequency ranges
	private readonly FREQUENCY_RANGES: Record<string, FrequencyRange> = {
		wifi_2_4: { start: 2400, stop: 2500, label: 'Wi-Fi 2.4GHz' },
		wifi_5: { start: 5170, stop: 5835, label: 'Wi-Fi 5GHz' },
		cellular_lte: { start: 700, stop: 2700, label: 'Cellular LTE' },
		ism_433: { start: 433, stop: 435, label: 'ISM 433MHz' },
		ism_915: { start: 902, stop: 928, label: 'ISM 915MHz' },
		gps_l1: { start: 1575, stop: 1576, label: 'GPS L1' },
		full_range: { start: 50, stop: 6000, label: 'Full Range' }
	};

	private constructor() {
		super();
		this.processManager = new ProcessManager();
		this.bufferManager = new BufferManager();

		this._setupEventHandlers();
		logInfo('[RF] USRP SweepManager instance created');
	}

	/**
	 * Get or create singleton instance
	 */
	static getInstance(): UsrpSweepManager {
		if (!UsrpSweepManager.instance) {
			UsrpSweepManager.instance = new UsrpSweepManager();
		}
		return UsrpSweepManager.instance;
	}

	/**
	 * Initialize the sweep manager
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			logInfo('[RF] USRP SweepManager already initialized');
			return;
		}

		if (this.initializationPromise) {
			logInfo('[RF] USRP SweepManager initialization already in progress');
			return this.initializationPromise;
		}

		this.initializationPromise = this._performInitialization();
		return this.initializationPromise;
	}

	private async _performInitialization(): Promise<void> {
		try {
			logInfo('[START] Initializing USRP SweepManager...');

			// Clean up any existing processes
			await this.processManager.forceCleanupAll();

			// Test USRP availability
			const availability = await this.processManager.testUsrpAvailability();
			if (!availability.available) {
				throw new Error(`USRP not available: ${availability.reason}`);
			}

			logInfo('[OK] USRP device available', {
				deviceInfo: availability.deviceInfo
			});

			this.isInitialized = true;
			this._emitEvent('initialized', {
				deviceInfo: availability.deviceInfo
			});
		} catch (error) {
			logError('Failed to initialize USRP SweepManager', { error });
			this._emitEvent('error', {
				message: 'Initialization failed',
				error
			});
			throw error;
		} finally {
			this.initializationPromise = null;
		}
	}

	/**
	 * Start frequency sweep with specified settings
	 */
	async startSweep(settings: SweepSettings): Promise<boolean> {
		try {
			// Ensure initialization
			if (!this.isInitialized) {
				await this.initialize();
			}

			// Check if already running
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

			// Test device availability
			const availability = await this.processManager.testUsrpAvailability();
			if (!availability.available) {
				this._emitError(`USRP not available: ${availability.reason}`, 'device_check');
				return false;
			}

			this.sweepSettings = settings;

			// Build command arguments for USRP spectrum scanning
			const args = this._buildSweepArgs(settings);

			logInfo('[START] Starting USRP sweep', { settings, args });

			// Clear buffer before starting
			this.bufferManager.clearBuffer();

			// Start the sweep process
			const processState = await this.processManager.spawnSweepProcess('python3', args);

			if (!processState.sweepProcess) {
				throw new Error('Failed to spawn USRP process');
			}

			this.isRunning = true;
			this.status = {
				state: SystemStatus.Running,
				message: `Sweeping ${settings.frequencyRange.label}`,
				details: settings
			};

			this._emitEvent('status', this.status);
			this._emitEvent('started', { settings });

			return true;
		} catch (error) {
			this._emitError(`Failed to start sweep: ${error}`, 'start_error');
			this.isRunning = false;
			this.status = { state: SystemStatus.Error };
			this._emitEvent('status', this.status);
			return false;
		}
	}

	/**
	 * Stop the current sweep
	 */
	async stopSweep(): Promise<void> {
		if (!this.isRunning) {
			logWarn('No sweep is running');
			return;
		}

		try {
			logInfo('[STOP] Stopping USRP sweep...');

			const processState = this.processManager.getProcessState();
			if (processState.sweepProcess) {
				await this.processManager.stopProcess(processState);
			}

			this.isRunning = false;
			this.sweepSettings = null;
			this.status = { state: SystemStatus.Idle };

			this._emitEvent('status', this.status);
			this._emitEvent('stopped');

			logInfo('[OK] USRP sweep stopped');
		} catch (error) {
			logError('Error stopping sweep', { error });
			// Force cleanup
			await this.processManager.forceKillProcess();
			this.isRunning = false;
			this.status = { state: SystemStatus.Error };
			this._emitEvent('status', this.status);
		}
	}

	/**
	 * Emergency stop - forcefully terminate all operations
	 */
	async emergencyStop(): Promise<void> {
		logWarn('[ALERT] USRP Emergency stop initiated');

		try {
			// Force kill the process immediately
			await this.processManager.forceKillProcess();

			// Clear all state
			this.isRunning = false;
			this.sweepSettings = null;
			this.status = { state: SystemStatus.Idle };

			// Emit events
			this._emitEvent('status', this.status);
			this._emitEvent('emergency_stopped');

			logWarn('[ALERT] USRP Emergency stop completed');
		} catch (error) {
			logError('Error during emergency stop', { error });
			// Even if there's an error, make sure we reset the state
			this.isRunning = false;
			this.status = { state: SystemStatus.Error };
		}
	}

	/**
	 * Set frequency range by preset name
	 */
	setFrequencyRange(rangeName: string): boolean {
		const range = this.FREQUENCY_RANGES[rangeName];
		if (!range) {
			logError(`Unknown frequency range: ${rangeName}`);
			return false;
		}

		if (this.isRunning) {
			logError('Cannot change frequency range while sweep is running');
			return false;
		}

		logInfo(`[RADIO] Frequency range set to ${range.label}`, { range });
		return true;
	}

	/**
	 * Get available frequency ranges
	 */
	getAvailableRanges(): Record<string, FrequencyRange> {
		return { ...this.FREQUENCY_RANGES };
	}

	/**
	 * Get current status
	 */
	getStatus(): SweepStatus & { isRunning: boolean; deviceInfo?: string } {
		const processState = this.processManager.getProcessState();
		return {
			...this.status,
			isRunning: this.isRunning && processState.isRunning,
			deviceInfo: this.isInitialized ? 'USRP B205 mini' : undefined
		};
	}

	/**
	 * Build command arguments for USRP sweep
	 */
	private _buildSweepArgs(settings: SweepSettings): string[] {
		// Create a Python script path - we'll write this script
		const scriptPath = './scripts/usrp_spectrum_scan.py';

		const args = [
			scriptPath,
			'--start-freq',
			(settings.frequencyRange.start * 1e6).toString(), // Convert MHz to Hz
			'--stop-freq',
			(settings.frequencyRange.stop * 1e6).toString(),
			'--sample-rate',
			(settings.sampleRate || 20e6).toString(), // Default 20 MHz sample rate
			'--gain',
			(settings.gain || 40).toString() // Default 40 dB gain
		];

		if (settings.bandwidth) {
			args.push('--bandwidth', settings.bandwidth.toString());
		}

		if (settings.antennaPort) {
			args.push('--antenna', settings.antennaPort);
		}

		return args;
	}

	/**
	 * Setup event handlers
	 */
	private _setupEventHandlers(): void {
		// Set up process event handlers
		this.processManager.setEventHandlers({
			onStdout: (data) => this._handleStdout(data),
			onStderr: (data) => this._handleStderr(data),
			onExit: (code, signal) => this._handleProcessExit(code, signal)
		});
	}

	/**
	 * Handle stdout data from USRP process
	 */
	private _handleStdout(data: Buffer): void {
		this.bufferManager.processDataChunk(data, (parsedLine: ParsedLine) => {
			if (parsedLine.isValid && parsedLine.data) {
				// Emit spectrum data
				this._emitEvent('spectrumData', parsedLine.data);

				// Log periodically
				if (Math.random() < 0.01) {
					// 1% of lines
					logDebug('[RF] USRP spectrum data', {
						frequency: parsedLine.data.frequency,
						power: parsedLine.data.power
					});
				}
			}
		});
	}

	/**
	 * Handle stderr data from USRP process
	 */
	private _handleStderr(data: Buffer): void {
		const message = data.toString().trim();

		// Check for errors
		if (message.toLowerCase().includes('error')) {
			logError('USRP process error', { message });
			this._emitEvent('error', { message });
		} else if (message.toLowerCase().includes('warning')) {
			logWarn('USRP process warning', { message });
		} else {
			// UHD often outputs info messages to stderr
			logInfo('USRP process info', { message });
		}
	}

	/**
	 * Handle process exit
	 */
	private _handleProcessExit(code: number | null, signal: string | null): void {
		logInfo('USRP process exited', { code, signal });

		this.isRunning = false;
		this.sweepSettings = null;

		if (code !== 0) {
			this.status = {
				state: SystemStatus.Error,
				message: `Process exited with code ${code}`
			};
			this._emitEvent('error', { code, signal });
		} else {
			this.status = { state: SystemStatus.Idle };
		}

		this._emitEvent('status', this.status);
		this._emitEvent('stopped');
	}

	/**
	 * Emit an event
	 */
	private _emitEvent(event: string, data?: unknown): void {
		this.emit(event, data);
	}

	/**
	 * Emit an error event
	 */
	private _emitError(message: string, context?: string): void {
		const error = { message, context, timestamp: new Date() };
		logError('USRP sweep error', error);
		this._emitEvent('error', error);
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		try {
			await this.stopSweep();
			await this.processManager.cleanup();
			this.bufferManager.cleanup();
			this.removeAllListeners();
			logInfo('[CLEANUP] USRP SweepManager cleanup completed');
		} catch (error) {
			logError('Error during cleanup', { error });
		}
	}

	/**
	 * Get buffer statistics
	 */
	getBufferStats() {
		return this.bufferManager.getBufferStats();
	}

	/**
	 * Get buffer health status
	 */
	getBufferHealth() {
		return this.bufferManager.getHealthStatus();
	}
}
