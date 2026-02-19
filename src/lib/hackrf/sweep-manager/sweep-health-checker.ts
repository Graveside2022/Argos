/**
 * Health monitoring, recovery, and process cleanup for sweep operations.
 * Extracted from SweepManager — functions take service references as parameters.
 */
import { execFile } from 'child_process';

import type { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

export interface CyclingHealth {
	status: string;
	processHealth: string;
	processStartupPhase: string;
	lastSwitchTime: Date | null;
	lastDataReceived: Date | null;
	recovery: {
		recoveryAttempts: number;
		maxRecoveryAttempts: number;
		lastRecoveryAttempt: Date | null;
		isRecovering: boolean;
	};
}

export interface HealthCheckContext {
	isRunning: boolean;
	cyclingHealth: CyclingHealth;
	processManager: ProcessManager;
	frequencyCycler: FrequencyCycler;
	bufferManager: BufferManager;
	errorTracker: ErrorTracker;
	emitEvent: (event: string, data: unknown) => void;
	emitError: (message: string, type: string, error?: Error) => void;
	startSweepProcess: (frequency: { value: number; unit: string }) => Promise<void>;
	stopSweep: () => Promise<void>;
}

/** Perform periodic health check on the running sweep process */
export async function performHealthCheck(ctx: HealthCheckContext): Promise<void> {
	const processState = ctx.processManager.getProcessState();
	if (!ctx.isRunning || !processState.isRunning) return;

	const now = Date.now();
	const cycleState = ctx.frequencyCycler.getCycleState();
	const recoveryStatus = ctx.errorTracker.getRecoveryStatus();

	logInfo('[HEALTH] Health check:', {
		isRunning: ctx.isRunning,
		hasSweepProcess: processState.isRunning,
		pid: processState.actualProcessPid,
		inFrequencyTransition: cycleState.inFrequencyTransition,
		isCycling: cycleState.isCycling,
		lastDataReceived: ctx.cyclingHealth.lastDataReceived?.toISOString(),
		processStartTime: processState.processStartTime
			? new Date(processState.processStartTime).toISOString()
			: null,
		recoveryAttempts: recoveryStatus.recoveryAttempts,
		isRecovering: recoveryStatus.isRecovering
	});

	try {
		const memInfo = await checkSystemMemory();
		logInfo(
			`[MEM] Memory: ${memInfo.availablePercent}% available (${memInfo.availableMB}MB / ${memInfo.totalMB}MB)`
		);
		if (memInfo.availablePercent < 10) {
			logWarn(`[WARN] Low memory: ${memInfo.availablePercent}% available`);
		}
	} catch (e) {
		logError('Failed to check memory:', { error: (e as Error).message });
	}

	if (ctx.cyclingHealth.recovery.isRecovering) {
		logInfo('[WAIT] Already in recovery, skipping health check');
		return;
	}

	let needsRecovery = false;
	let reason = '';

	if (ctx.cyclingHealth.lastDataReceived) {
		const timeSinceData = now - ctx.cyclingHealth.lastDataReceived.getTime();
		logInfo(`[STATUS] Time since last data: ${Math.round(timeSinceData / 1000)}s`);
		if (timeSinceData > 7200000) {
			needsRecovery = true;
			reason = 'No data received for 2 hours';
		}
	} else if (processState.processStartTime && now - processState.processStartTime > 60000) {
		const runTime = Math.round((now - processState.processStartTime) / 1000);
		logWarn(`[TIMER] Process running for ${runTime}s with no data`);
		needsRecovery = true;
		reason = 'No initial data received';
	}

	if (processState.isRunning && processState.actualProcessPid) {
		const isAlive = ctx.processManager.isProcessAlive(processState.actualProcessPid);
		if (isAlive) {
			logInfo(`[OK] Process ${processState.actualProcessPid} is still alive`);
		} else {
			needsRecovery = true;
			reason = 'Process no longer exists';
		}
	}

	if (needsRecovery) {
		logWarn(`[WARN] Health check failed: ${reason}`);
		ctx.cyclingHealth.processHealth = 'unhealthy';
		await performRecovery(ctx, reason);
	} else if (ctx.cyclingHealth.lastDataReceived) {
		ctx.cyclingHealth.processHealth = 'healthy';
	}
}

/** Attempt recovery of a failed sweep process */
export async function performRecovery(ctx: HealthCheckContext, reason: string): Promise<void> {
	const recoveryStatus = ctx.errorTracker.getRecoveryStatus();

	logInfo('Recovery triggered via ErrorTracker', { reason, recoveryStatus });

	if (!ctx.errorTracker.shouldAttemptRecovery()) {
		logError('ErrorTracker recommends stopping recovery attempts');
		ctx.emitError('Max recovery attempts reached', 'recovery_failed');
		await ctx.stopSweep();
		return;
	}

	ctx.errorTracker.startRecovery();
	ctx.cyclingHealth.recovery.isRecovering = true;

	ctx.emitEvent('recovery_start', {
		reason,
		attempt: recoveryStatus.recoveryAttempts + 1,
		maxAttempts: 3
	});

	try {
		await ctx.processManager.forceKillProcess();
		await ctx.processManager.cleanup();
		await new Promise((resolve) => setTimeout(resolve, 2000));

		const cycleState = ctx.frequencyCycler.getCycleState();
		if (cycleState.currentFrequency && ctx.isRunning) {
			await ctx.startSweepProcess(cycleState.currentFrequency);
			ctx.errorTracker.recordSuccess();
			logInfo('Recovery completed via services');
			ctx.emitEvent('recovery_complete', { reason });
		}
	} catch (error: unknown) {
		const err = error as Error;
		ctx.errorTracker.recordError(err, { operation: 'recovery' });
		logError('Recovery failed', { error: err, reason });
		ctx.emitError(`Recovery failed: ${err.message}`, 'recovery_error');
		await ctx.stopSweep();
	} finally {
		ctx.cyclingHealth.recovery.isRecovering = false;
	}
}

/** Check system memory usage via /usr/bin/free */
export function checkSystemMemory(): Promise<{
	availablePercent: number;
	totalMB: number;
	availableMB: number;
}> {
	return new Promise((resolve, reject) => {
		execFile('/usr/bin/free', ['-m'], (error, stdout) => {
			if (error) return reject(error);
			const lines = stdout.trim().split('\n');
			const parts = lines[1].split(/\s+/);
			const totalMB = parseInt(parts[1]);
			const availableMB = parseInt(parts[6] || parts[3]);
			const availablePercent = Math.round((availableMB / totalMB) * 100);
			resolve({ availablePercent, totalMB, availableMB });
		});
	});
}

/** Force cleanup of any lingering hackrf_sweep, hackrf_info, sweep_bridge processes */
export async function forceCleanupExistingProcesses(processManager: ProcessManager): Promise<void> {
	logInfo('Force cleaning up existing HackRF processes', {}, 'hackrf-cleanup-start');

	try {
		const processState = processManager.getProcessState();

		if (processState.isRunning && processState.sweepProcessPgid) {
			await new Promise<void>((resolve) => {
				execFile('/usr/bin/pgrep', ['-x', 'hackrf_sweep'], (err, stdout) => {
					if (err || !stdout.trim()) return resolve();
					const pids = stdout.trim().split('\n');
					for (const pid of pids) {
						const pidNum = parseInt(pid, 10);
						if (pidNum !== processState.sweepProcessPgid) {
							try {
								process.kill(pidNum, 'SIGKILL');
							} catch {
								/* already dead */
							}
						}
					}
					resolve();
				});
			});
		} else {
			await new Promise<void>((resolve) => {
				execFile('/usr/bin/pkill', ['-9', '-x', 'hackrf_sweep'], () => resolve());
			});
		}

		await new Promise<void>((resolve) => {
			execFile('/usr/bin/pkill', ['-9', '-f', 'hackrf_info'], () => resolve());
		});

		await new Promise<void>((resolve) => {
			execFile('/usr/bin/pkill', ['-9', '-f', 'sweep_bridge.py'], () => resolve());
		});

		await new Promise((resolve) => setTimeout(resolve, 1000));
		logInfo('Cleanup complete', {}, 'hackrf-cleanup-complete');
	} catch (error) {
		logError('Cleanup failed', { error }, 'hackrf-cleanup-failed');
	}
}
