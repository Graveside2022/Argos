import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type ChildProcess, execFile, spawn } from 'child_process';

import { logError, logInfo, logWarn } from '$lib/utils/logger';

import { forceCleanupAllProcesses, forceKillAllProcesses, stopProcess } from './process-lifecycle';

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
				logInfo(`[START] Spawning real hackrf_sweep with args: ${args.join(' ')}`);

				const modifiedConfig = {
					...config,
					env: {
						...process.env,
						NODE_NO_READLINE: '1',
						PYTHONUNBUFFERED: '1'
					}
				};
				const __filename = fileURLToPath(import.meta.url);
				const __dirname = dirname(__filename);
				const scriptPath = join(__dirname, 'auto_sweep.sh');

				logInfo(`[FILE] Script path resolved to: ${scriptPath}`);

				const sweepProcess = spawn(scriptPath, args, modifiedConfig);
				const sweepProcessPgid = sweepProcess.pid || null;
				const actualProcessPid = sweepProcess.pid || null;
				const processStartTime = Date.now();

				if (actualProcessPid) {
					this.processRegistry.set(actualProcessPid, sweepProcess);
				}

				logInfo(
					`[OK] Real HackRF process spawned with PID: ${actualProcessPid}, PGID: ${sweepProcessPgid}`
				);

				this.attachEventHandlers(sweepProcess);

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

	/** Attach stdout/stderr/exit handlers to a spawned process */
	private attachEventHandlers(sweepProcess: ChildProcess): void {
		if (sweepProcess.stdout && this.eventHandlers.onStdout) {
			const stdoutHandler = this.eventHandlers.onStdout;
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
	}

	/**
	 * Stop a specific process
	 */
	async stopProcess(processState: ProcessState): Promise<void> {
		return stopProcess(processState, this.processRegistry);
	}

	/**
	 * Force cleanup all HackRF processes
	 */
	async forceCleanupAll(): Promise<void> {
		return forceCleanupAllProcesses(this.processRegistry);
	}

	/**
	 * Set event handlers for process monitoring
	 */
	setEventHandlers(handlers: {
		onStdout?: (data: Buffer) => void;
		onStderr?: (data: Buffer) => void;
		onExit?: (code: number | null, signal: string | null) => void;
	}): void {
		this.eventHandlers = handlers;
		logInfo('Process event handlers set for real hardware');
	}

	/**
	 * Get current process state
	 */
	getProcessState(): ProcessState & { isRunning: boolean } {
		for (const [pid, _childProcess] of this.processRegistry) {
			if (!this.isProcessAlive(pid)) {
				logWarn(`Process ${pid} is dead, removing from registry`);
				this.processRegistry.delete(pid);
			}
		}

		const isRunning = this.processRegistry.size > 0;
		const firstProcess = this.processRegistry.values().next().value || null;
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
			execFile('/usr/bin/timeout', ['3', 'hackrf_info'], (error, stdout, stderr) => {
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
	 * Force kill process immediately
	 */
	async forceKillProcess(): Promise<void> {
		return forceKillAllProcesses(this.processRegistry);
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		await this.forceCleanupAll();
	}
}
