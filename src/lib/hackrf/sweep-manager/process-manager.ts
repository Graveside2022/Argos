import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type ChildProcess, execFile, spawn } from 'child_process';

import { logger } from '$lib/utils/logger';

import { forceCleanupAllProcesses, forceKillAllProcesses, stopProcess } from './process-lifecycle';
import type { ProcessConfig, ProcessState } from './process-manager-types';

// Re-export types for backward compatibility
export type { ProcessConfig, ProcessState } from './process-manager-types';

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

	private buildSpawnConfig(config: ProcessConfig): ProcessConfig & { env: NodeJS.ProcessEnv } {
		return {
			...config,
			env: {
				...process.env,
				NODE_NO_READLINE: '1',
				PYTHONUNBUFFERED: '1'
			}
		};
	}

	private resolveScriptPath(): string {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);
		return join(__dirname, 'auto_sweep.sh');
	}

	private registerProcess(sweepProcess: ChildProcess): ProcessState {
		const pid = sweepProcess.pid || null;
		const processStartTime = Date.now();

		if (pid) {
			this.processRegistry.set(pid, sweepProcess);
		}

		logger.info(`[OK] Real HackRF process spawned with PID: ${pid}`);
		this.attachEventHandlers(sweepProcess);

		return {
			sweepProcess,
			sweepProcessPgid: pid,
			actualProcessPid: pid,
			processStartTime
		};
	}

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
		logger.info(`[START] Spawning real hackrf_sweep with args: ${args.join(' ')}`);
		const scriptPath = this.resolveScriptPath();
		logger.info(`[FILE] Script path resolved to: ${scriptPath}`);

		const sweepProcess = spawn(scriptPath, args, this.buildSpawnConfig(config));
		return this.registerProcess(sweepProcess);
	}

	private attachStdoutHandler(sweepProcess: ChildProcess): void {
		if (!sweepProcess.stdout || !this.eventHandlers.onStdout) {
			logger.error('Failed to attach stdout handler', {
				hasStdout: !!sweepProcess.stdout,
				hasHandler: !!this.eventHandlers.onStdout
			});
			return;
		}
		sweepProcess.stdout.on('data', this.eventHandlers.onStdout);
		logger.info('Attached stdout handler to real process');
	}

	/** Attach stdout/stderr/exit handlers to a spawned process */
	private attachEventHandlers(sweepProcess: ChildProcess): void {
		this.attachStdoutHandler(sweepProcess);

		if (sweepProcess.stderr && this.eventHandlers.onStderr) {
			sweepProcess.stderr.on('data', this.eventHandlers.onStderr);
			logger.info('Attached stderr handler to real process');
		}

		if (this.eventHandlers.onExit) {
			sweepProcess.on('exit', this.eventHandlers.onExit);
			logger.info('Attached exit handler to real process');
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
		logger.info('Process event handlers set for real hardware');
	}

	private pruneDeadProcesses(): void {
		for (const [pid] of this.processRegistry) {
			if (!this.isProcessAlive(pid)) {
				logger.warn(`Process ${pid} is dead, removing from registry`);
				this.processRegistry.delete(pid);
			}
		}
	}

	private static readonly EMPTY_STATE: ProcessState & { isRunning: boolean } = {
		sweepProcess: null,
		sweepProcessPgid: null,
		actualProcessPid: null,
		processStartTime: null,
		isRunning: false
	};

	/**
	 * Get current process state
	 */
	getProcessState(): ProcessState & { isRunning: boolean } {
		this.pruneDeadProcesses();
		const firstProcess: ChildProcess | undefined = this.processRegistry.values().next().value;
		if (!firstProcess) return { ...ProcessManager.EMPTY_STATE };
		const pid = firstProcess.pid ?? null;
		return {
			sweepProcess: firstProcess,
			sweepProcessPgid: pid,
			actualProcessPid: pid,
			processStartTime: Date.now(),
			isRunning: true
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

	private parseHackrfInfoError(error: Error & { code?: string | number | null }): {
		available: boolean;
		reason: string;
	} {
		const reason =
			error.code === 124 ? 'Device check timeout' : `Device check failed: ${error.message}`;
		return { available: false, reason };
	}

	private parseHackrfInfoOutput(
		stdout: string,
		stderr: string
	): { available: boolean; reason: string; deviceInfo?: string } {
		if (stderr.includes('Resource busy')) {
			return { available: false, reason: 'Device busy' };
		}
		if (stderr.includes('No HackRF boards found')) {
			return { available: false, reason: 'No HackRF found' };
		}
		if (stdout.includes('Serial number')) {
			const deviceInfo = stdout
				.split('\n')
				.filter((line) => line.trim())
				.join(', ');
			return { available: true, reason: 'HackRF detected', deviceInfo };
		}
		return { available: false, reason: 'Unknown error' };
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
					resolve(this.parseHackrfInfoError(error));
				} else {
					resolve(this.parseHackrfInfoOutput(stdout, stderr));
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
