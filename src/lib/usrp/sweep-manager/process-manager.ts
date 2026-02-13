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
 * Manages USRP process lifecycle - spawning, monitoring, and cleanup
 * Uses UHD (USRP Hardware Driver) tools
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
	 * Spawn a new USRP spectrum scan process
	 */
	async spawnSweepProcess(
		command: string,
		args: string[],
		config: ProcessConfig = {
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe']
		}
	): Promise<ProcessState> {
		return new Promise((resolve, reject) => {
			try {
				logInfo(`[START] Spawning USRP process: ${command} ${args.join(' ')}`);

				// Use unbuffered output for real-time data
				const modifiedConfig = {
					...config,
					env: {
						...process.env,
						NODE_NO_READLINE: '1',
						PYTHONUNBUFFERED: '1', // For Python-based UHD tools
						UHD_IMAGES_DIR: '/usr/share/uhd/images' // UHD firmware images location
					}
				};
				const sweepProcess = spawn(command, args, modifiedConfig);
				const sweepProcessPgid = sweepProcess.pid || null;
				const actualProcessPid = sweepProcess.pid || null;
				const processStartTime = Date.now();

				// Register process
				if (actualProcessPid) {
					this.processRegistry.set(actualProcessPid, sweepProcess);
				}

				logInfo(
					`[OK] USRP process spawned with PID: ${actualProcessPid}, PGID: ${sweepProcessPgid}`
				);

				// Attach event handlers to the process
				if (sweepProcess.stdout && this.eventHandlers.onStdout) {
					sweepProcess.stdout.on('data', this.eventHandlers.onStdout);
					logInfo('Attached stdout handler to USRP process');
				}

				if (sweepProcess.stderr && this.eventHandlers.onStderr) {
					sweepProcess.stderr.on('data', this.eventHandlers.onStderr);
					logInfo('Attached stderr handler to USRP process');
				}

				if (this.eventHandlers.onExit) {
					sweepProcess.on('exit', this.eventHandlers.onExit);
					logInfo('Attached exit handler to USRP process');
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
			'Stopping USRP process',
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

		// Ensure UHD processes are not running using system command as backup
		try {
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f "uhd_.*"', (error) => {
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
	 * Force cleanup all USRP processes
	 */
	async forceCleanupAll(): Promise<void> {
		logInfo('Force cleaning up existing USRP processes', {}, 'usrp-cleanup-start');

		try {
			// Kill all UHD processes
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f "uhd_.*"', () => resolve());
			});

			// Kill any Python UHD scripts
			await new Promise<void>((resolve) => {
				exec('pkill -9 -f "usrp.*py"', () => resolve());
			});

			// Clear registry
			this.processRegistry.clear();

			// Wait for cleanup
			await new Promise((resolve) => setTimeout(resolve, 1000));

			logInfo('Cleanup complete', {}, 'usrp-cleanup-complete');
		} catch (error) {
			logError('Cleanup failed', { error }, 'usrp-cleanup-failed');
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
		logInfo('Process event handlers set for USRP');
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
	 * Test USRP device availability
	 */
	async testUsrpAvailability(): Promise<{
		available: boolean;
		reason: string;
		deviceInfo?: string;
	}> {
		return new Promise((resolve) => {
			exec(
				'UHD_IMAGES_DIR=/usr/share/uhd/images timeout 5 uhd_find_devices',
				(error, stdout, stderr) => {
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
					} else if (stderr.includes('No UHD Devices Found')) {
						resolve({ available: false, reason: 'No USRP found' });
					} else if (stdout.includes('Device Address')) {
						// Extract device info
						const deviceInfo = stdout
							.split('\n')
							.filter((line) => line.trim())
							.join(', ');
						resolve({
							available: true,
							reason: 'USRP detected',
							deviceInfo
						});
					} else {
						resolve({ available: false, reason: 'Unknown error' });
					}
				}
			);
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

		// Force cleanup all USRP processes
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
