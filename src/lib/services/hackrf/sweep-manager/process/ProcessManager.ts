import { spawn, exec, type ChildProcess } from 'child_process';
import { logInfo, logError, logWarn } from '$lib/utils/logger';

export interface ProcessState {
	sweepProcess: ChildProcess | null;
	sweepProcessPgid: number | null;
	actualProcessPid: number | null;
	processStartTime: number | null;
}

export interface ProcessConfig {
	detached: boolean;
	stdio: ('pipe' | 'inherit' | 'ignore')[];
	timeout?: number;
}

/**
 * Manages HackRF process lifecycle - spawning, monitoring, and cleanup
 */
export class ProcessManager {
	private processRegistry = new Map<number, ChildProcess>();
	private processMonitorInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Spawn a new HackRF sweep process
	 */
	async spawnSweepProcess(
		args: string[],
		config: ProcessConfig = { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
	): Promise<ProcessState> {
		return new Promise((resolve, reject) => {
			try {
				logInfo(`🚀 Spawning hackrf_sweep with args: ${args.join(' ')}`);

				const sweepProcess = spawn('hackrf_sweep', args, config);
				const sweepProcessPgid = sweepProcess.pid || null;
				const actualProcessPid = sweepProcess.pid || null;
				const processStartTime = Date.now();

				// Register process
				if (actualProcessPid) {
					this.processRegistry.set(actualProcessPid, sweepProcess);
				}

				logInfo(`✅ Process spawned with PID: ${actualProcessPid}, PGID: ${sweepProcessPgid}`);

				const processState: ProcessState = {
					sweepProcess,
					sweepProcessPgid,
					actualProcessPid,
					processStartTime
				};

				resolve(processState);
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/**
	 * Stop a specific process
	 */
	async stopProcess(processState: ProcessState): Promise<void> {
		if (!processState.sweepProcess) {
			return;
		}

		logInfo(
			'Stopping sweep process',
			{ pid: processState.actualProcessPid, pgid: processState.sweepProcessPgid },
			'process-stopping'
		);

		try {
			// Try SIGTERM first for graceful shutdown
			if (processState.actualProcessPid) {
				try {
					process.kill(processState.actualProcessPid, 'SIGTERM');
					logInfo(
						'Sent SIGTERM to process',
						{ pid: processState.actualProcessPid },
						'process-sigterm-sent'
					);
				} catch {
					logWarn(
						'Process already dead or SIGTERM failed',
						{ pid: processState.actualProcessPid },
						'process-sigterm-failed'
					);
				}

				// Give it a moment to terminate gracefully
				await new Promise((resolve) => setTimeout(resolve, 100));

				// Check if process still exists
				try {
					process.kill(processState.actualProcessPid, 0);
					// Process still exists, force kill
					logWarn(
						'Process still alive, sending SIGKILL',
						{ pid: processState.actualProcessPid },
						'process-sigkill-needed'
					);
					process.kill(processState.actualProcessPid, 'SIGKILL');
				} catch {
					// Process is already dead
					logInfo(
						'Process terminated successfully',
						{ pid: processState.actualProcessPid },
						'process-terminated'
					);
				}
			}

			// Also try to kill the entire process group if we're using detached mode
			if (
				processState.sweepProcessPgid &&
				processState.sweepProcessPgid !== processState.actualProcessPid
			) {
				try {
					process.kill(-processState.sweepProcessPgid, 'SIGKILL');
					logInfo(
						'Killed process group',
						{ pgid: processState.sweepProcessPgid },
						'process-group-killed'
					);
				} catch (e) {
					// Process group might already be dead
					logError(
						'Process group kill failed',
						{ error: e, pgid: processState.sweepProcessPgid },
						'process-group-kill-failed'
					);
				}
			}
		} catch (error) {
			logError('Error during process termination', { error }, 'process-termination-error');
		}

		// Remove from registry
		if (processState.actualProcessPid) {
			this.processRegistry.delete(processState.actualProcessPid);
		}

		// Ensure hackrf_sweep is not running using system command as backup
		try {
			await new Promise<void>((resolve) => {
				exec('pkill -9 -x hackrf_sweep', (error) => {
					if (error && error.code !== 1) {
						// Exit code 1 means no processes found
						logError('pkill error', { error }, 'pkill-error');
					}
					resolve();
				});
			});
		} catch (e) {
			logError('Failed to run pkill', { error: e }, 'pkill-failed');
		}

		// Wait for cleanup
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	/**
	 * Force cleanup all HackRF processes
	 */
	async forceCleanupAll(): Promise<void> {
		logInfo('Force cleaning up existing HackRF processes', {}, 'hackrf-cleanup-start');

		try {
			// Kill all hackrf_sweep processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -x hackrf_sweep', () => resolve());
			});

			// Kill any hackrf_info processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f hackrf_info', () => resolve());
			});

			// Clear registry
			this.processRegistry.clear();

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 1000));

			logInfo('Cleanup complete', {}, 'hackrf-cleanup-complete');
		} catch (error) {
			logError('Cleanup failed', { error }, 'hackrf-cleanup-failed');
		}
	}

	/**
	 * Emergency kill all processes
	 */
	async emergencyKillAll(): Promise<void> {
		logWarn('Emergency process kill initiated');

		// Kill all registered processes
		for (const [pid, childProcess] of this.processRegistry) {
			try {
				if (childProcess && !childProcess.killed) {
					childProcess.kill('SIGKILL');
				}
				// Also kill by PID directly
				try {
					process.kill(pid, 'SIGKILL');
					logInfo(`Emergency killed PID: ${pid}`);
				} catch {
					logInfo('Process already dead or kill failed');
				}
			} catch (e) {
				logError('Emergency kill failed', { error: e, pid }, 'emergency-kill');
			}
		}

		// Clear all monitoring
		if (this.processMonitorInterval) {
			clearInterval(this.processMonitorInterval);
			this.processMonitorInterval = null;
		}

		// Force cleanup all hackrf processes
		await this.forceCleanupAll();

		logInfo('✅ Emergency process kill completed');
	}

	/**
	 * Check if process is alive
	 */
	isProcessAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Start monitoring a process
	 */
	startProcessMonitoring(
		processState: ProcessState,
		onProcessDeath?: (exitCode: number | null, signal: string | null) => void
	): void {
		if (!processState.actualProcessPid) return;

		// Clear any existing monitoring
		if (this.processMonitorInterval) {
			clearInterval(this.processMonitorInterval);
		}

		// Monitor process every 2 seconds
		this.processMonitorInterval = setInterval(() => {
			if (!processState.actualProcessPid) return;

			if (!this.isProcessAlive(processState.actualProcessPid)) {
				logError(
					'Process monitor: Process no longer exists',
					{ pid: processState.actualProcessPid },
					'process-dead'
				);

				// Remove from registry
				this.processRegistry.delete(processState.actualProcessPid);

				// Trigger callback if provided
				if (onProcessDeath) {
					onProcessDeath(null, 'UNKNOWN');
				}

				// Clear monitoring
				if (this.processMonitorInterval) {
					clearInterval(this.processMonitorInterval);
					this.processMonitorInterval = null;
				}
			}
		}, 2000);
	}

	/**
	 * Stop process monitoring
	 */
	stopProcessMonitoring(): void {
		if (this.processMonitorInterval) {
			clearInterval(this.processMonitorInterval);
			this.processMonitorInterval = null;
		}
	}

	/**
	 * Test HackRF device availability
	 */
	async testHackrfAvailability(): Promise<{
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
	 * Check if error is critical startup error
	 */
	isCriticalStartupError(message: string): boolean {
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
	 * Get all registered process PIDs
	 */
	getRegisteredProcesses(): number[] {
		return Array.from(this.processRegistry.keys());
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		this.stopProcessMonitoring();
		await this.emergencyKillAll();
	}
}