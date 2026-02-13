import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type ChildProcess, exec, spawn } from 'child_process';

import { logError, logInfo, logWarn } from '$lib/utils/logger';

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
	startupTimeoutMs?: number;
}

/**
 * Manages HackRF process lifecycle - spawning, monitoring, and cleanup
 * NO MOCK FUNCTIONALITY - REAL HARDWARE ONLY
 */
export class ProcessManager {
	private processRegistry = new Map<number, ChildProcess>();
	private processMonitorInterval: ReturnType<typeof setInterval> | null = null;
	private eventHandlers: {
		onStdout?: (data: Buffer) => void;
		onStderr?: (data: Buffer) => void;
		onExit?: (code: number | null, signal: string | null) => void;
	} = {};

	/**
	 * Spawn a new HackRF sweep process - REAL HARDWARE ONLY
	 */
	async spawnSweepProcess(
		args: string[],
		config: ProcessConfig = {
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe']
		}
	): Promise<ProcessState> {
		return new Promise((resolve, reject) => {
			try {
				// Event handlers are set, proceeding with spawn

				logInfo(`[START] Spawning real hackrf_sweep with args: ${args.join(' ')}`);

				// Use unbuffered output for real-time data
				const modifiedConfig = {
					...config,
					env: {
						...process.env,
						NODE_NO_READLINE: '1',
						PYTHONUNBUFFERED: '1'
						// Auto-detect device - auto_sweep.sh will check for HackRF or USRP
					}
				};
				// Use auto_sweep.sh which detects HackRF or USRP B205 Mini
				// Use proper ESM path resolution for Vite compatibility
				const __filename = fileURLToPath(import.meta.url);
				const __dirname = dirname(__filename);
				const scriptPath = join(__dirname, 'auto_sweep.sh');

				logInfo(`[FILE] Script path resolved to: ${scriptPath}`);

				// Spawning process with modified config

				// Use the config as passed, sweep manager now handles detached setting
				const sweepProcess = spawn(scriptPath, args, modifiedConfig);
				const sweepProcessPgid = sweepProcess.pid || null;
				const actualProcessPid = sweepProcess.pid || null;
				const processStartTime = Date.now();

				// Process spawned with PID: ${actualProcessPid}

				// Register process
				if (actualProcessPid) {
					this.processRegistry.set(actualProcessPid, sweepProcess);
				}

				logInfo(
					`[OK] Real HackRF process spawned with PID: ${actualProcessPid}, PGID: ${sweepProcessPgid}`
				);

				// Attach event handlers to the process
				if (sweepProcess.stdout && this.eventHandlers.onStdout) {
					const stdoutHandler = this.eventHandlers.onStdout;

					// Forward stdout data to handler without verbose logging.
					// Previous implementation logged every data chunk with preview
					// strings, creating significant GC pressure in the hot path.
					sweepProcess.stdout.on('data', (data: Buffer) => {
						if (stdoutHandler) {
							stdoutHandler(data);
						} else {
							logError('Stdout handler disappeared unexpectedly');
						}
					});
					logInfo('Attached stdout handler to real process');
				} else {
					const error = {
						hasStdout: !!sweepProcess.stdout,
						hasHandler: !!this.eventHandlers.onStdout
					};
					// Failed to attach stdout handler
					logError('Failed to attach stdout handler', error);
				}

				if (sweepProcess.stderr && this.eventHandlers.onStderr) {
					sweepProcess.stderr.on('data', this.eventHandlers.onStderr);
					logInfo('Attached stderr handler to real process');
				}

				if (this.eventHandlers.onExit) {
					sweepProcess.on('exit', this.eventHandlers.onExit);
					logInfo('Attached exit handler to real process');
				}

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
			{
				pid: processState.actualProcessPid,
				pgid: processState.sweepProcessPgid
			},
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
				} catch (_error: unknown) {
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
				} catch (_error: unknown) {
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

			// Kill any USRP spectrum scan processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f usrp_spectrum_scan.py', () => resolve());
			});

			// Kill any Python processes using UHD/USRP
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f "python.*usrp"', () => resolve());
			});

			// Kill any mock sweep processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f mock_sweep.sh', () => resolve());
			});

			// Kill any auto_sweep processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f auto_sweep.sh', () => resolve());
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
	 * Set event handlers for process monitoring
	 */
	setEventHandlers(handlers: {
		onStdout?: (data: Buffer) => void;
		onStderr?: (data: Buffer) => void;
		onExit?: (code: number | null, signal: string | null) => void;
	}): void {
		// Store handlers for future spawned processes
		this.eventHandlers = handlers;
		logInfo('Process event handlers set for real hardware');
	}

	/**
	 * Get current process state
	 */
	getProcessState(): ProcessState & { isRunning: boolean } {
		// Clean up dead processes from registry
		for (const [pid, _childProcess] of this.processRegistry) {
			if (!this.isProcessAlive(pid)) {
				logWarn(`Process ${pid} is dead, removing from registry`);
				this.processRegistry.delete(pid);
			}
		}

		const isRunning = this.processRegistry.size > 0;
		// Get the first process if any exist
		const firstProcess = this.processRegistry.values().next().value || null;

		// Store process start time separately from the process object
		const processStartTime = firstProcess ? Date.now() : null;

		return {
			sweepProcess: firstProcess,
			sweepProcessPgid: firstProcess?.pid || null,
			actualProcessPid: firstProcess?.pid || null,
			processStartTime,
			isRunning
		};
	}

	/**
	 * Check if process is alive
	 */
	isProcessAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch (_error: unknown) {
			return false;
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
						resolve({
							available: false,
							reason: 'Device check timeout'
						});
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
					resolve({
						available: true,
						reason: 'HackRF detected',
						deviceInfo
					});
				} else {
					resolve({ available: false, reason: 'Unknown error' });
				}
			});
		});
	}

	/**
	 * Force kill process immediately
	 */
	async forceKillProcess(): Promise<void> {
		const _processState = this.getProcessState();

		// Kill all registered processes
		for (const [pid, childProcess] of this.processRegistry) {
			try {
				if (childProcess && !childProcess.killed) {
					childProcess.kill('SIGKILL');
				}
				// Also kill by PID directly
				try {
					process.kill(pid, 'SIGKILL');
					logInfo(`Force killed PID: ${pid}`);
				} catch (_error: unknown) {
					logInfo('Process already dead or kill failed');
				}
			} catch (e) {
				logError('Force kill failed', { error: e, pid }, 'force-kill');
			}
		}

		// Clear registry
		this.processRegistry.clear();

		// Force cleanup all hackrf processes
		await this.forceCleanupAll();

		logInfo('[OK] Force process kill completed');
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		await this.forceCleanupAll();
	}
}
