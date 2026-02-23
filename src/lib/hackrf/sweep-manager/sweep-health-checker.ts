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

interface ProcessStateSnapshot {
	isRunning: boolean;
	actualProcessPid: number | null;
	processStartTime: number | null;
}

function logHealthCheckState(ctx: HealthCheckContext, processState: ProcessStateSnapshot): void {
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
}

async function logMemoryStatus(): Promise<void> {
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
}

function checkDataStaleness(
	lastDataReceived: Date | null,
	processStartTime: number | null,
	now: number
): { needsRecovery: boolean; reason: string } {
	if (lastDataReceived) {
		const timeSinceData = now - lastDataReceived.getTime();
		logInfo(`[STATUS] Time since last data: ${Math.round(timeSinceData / 1000)}s`);
		if (timeSinceData > 7200000) {
			return { needsRecovery: true, reason: 'No data received for 2 hours' };
		}
		return { needsRecovery: false, reason: '' };
	}
	if (processStartTime && now - processStartTime > 60000) {
		const runTime = Math.round((now - processStartTime) / 1000);
		logWarn(`[TIMER] Process running for ${runTime}s with no data`);
		return { needsRecovery: true, reason: 'No initial data received' };
	}
	return { needsRecovery: false, reason: '' };
}

function checkProcessLiveness(
	ctx: HealthCheckContext,
	processState: ProcessStateSnapshot
): string | null {
	if (!processState.isRunning || !processState.actualProcessPid) return null;
	const isAlive = ctx.processManager.isProcessAlive(processState.actualProcessPid);
	if (isAlive) {
		logInfo(`[OK] Process ${processState.actualProcessPid} is still alive`);
		return null;
	}
	return 'Process no longer exists';
}

function determineRecoveryNeed(
	ctx: HealthCheckContext,
	processState: ProcessStateSnapshot
): { needsRecovery: boolean; reason: string } {
	const deadReason = checkProcessLiveness(ctx, processState);
	if (deadReason) return { needsRecovery: true, reason: deadReason };

	return checkDataStaleness(
		ctx.cyclingHealth.lastDataReceived,
		processState.processStartTime,
		Date.now()
	);
}

async function applyHealthResult(
	ctx: HealthCheckContext,
	needsRecovery: boolean,
	reason: string
): Promise<void> {
	if (needsRecovery) {
		logWarn(`[WARN] Health check failed: ${reason}`);
		ctx.cyclingHealth.processHealth = 'unhealthy';
		await performRecovery(ctx, reason);
	} else if (ctx.cyclingHealth.lastDataReceived) {
		ctx.cyclingHealth.processHealth = 'healthy';
	}
}

function isHealthCheckSkippable(ctx: HealthCheckContext, processRunning: boolean): boolean {
	return !ctx.isRunning || !processRunning || ctx.cyclingHealth.recovery.isRecovering;
}

/** Perform periodic health check on the running sweep process */
export async function performHealthCheck(ctx: HealthCheckContext): Promise<void> {
	const processState = ctx.processManager.getProcessState();
	if (isHealthCheckSkippable(ctx, processState.isRunning)) {
		if (ctx.cyclingHealth.recovery.isRecovering) {
			logInfo('[WAIT] Already in recovery, skipping health check');
		}
		return;
	}

	logHealthCheckState(ctx, processState);
	await logMemoryStatus();

	const { needsRecovery, reason } = determineRecoveryNeed(ctx, processState);
	await applyHealthResult(ctx, needsRecovery, reason);
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

function parseFreeOutput(stdout: string): {
	availablePercent: number;
	totalMB: number;
	availableMB: number;
} {
	const lines = stdout.trim().split('\n');
	const parts = lines[1].split(/\s+/);
	const totalMB = parseInt(parts[1]);
	const availableMB = parseInt(parts[6] || parts[3]);
	const availablePercent = Math.round((availableMB / totalMB) * 100);
	return { availablePercent, totalMB, availableMB };
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
			resolve(parseFreeOutput(stdout));
		});
	});
}

function pkillAsync(args: string[]): Promise<void> {
	return new Promise<void>((resolve) => {
		execFile('/usr/bin/pkill', args, () => resolve());
	});
}

function killPidsExcluding(stdout: string, excludePgid: number): void {
	for (const pid of stdout.trim().split('\n')) {
		const pidNum = parseInt(pid, 10);
		if (pidNum === excludePgid) continue;
		try {
			process.kill(pidNum, 'SIGKILL');
		} catch {
			/* already dead */
		}
	}
}

function killOrphanSweepProcesses(excludePgid: number): Promise<void> {
	return new Promise<void>((resolve) => {
		execFile('/usr/bin/pgrep', ['-x', 'hackrf_sweep'], (err, stdout) => {
			if (err || !stdout.trim()) return resolve();
			killPidsExcluding(stdout, excludePgid);
			resolve();
		});
	});
}

/** Force cleanup of any lingering hackrf_sweep, hackrf_info, sweep_bridge processes */
export async function forceCleanupExistingProcesses(processManager: ProcessManager): Promise<void> {
	logInfo('Force cleaning up existing HackRF processes', {}, 'hackrf-cleanup-start');

	try {
		const processState = processManager.getProcessState();

		if (processState.isRunning && processState.sweepProcessPgid) {
			await killOrphanSweepProcesses(processState.sweepProcessPgid);
		} else {
			await pkillAsync(['-9', '-x', 'hackrf_sweep']);
		}

		await pkillAsync(['-9', '-f', 'hackrf_info']);
		await pkillAsync(['-9', '-f', 'sweep_bridge.py']);

		await new Promise((resolve) => setTimeout(resolve, 1000));
		logInfo('Cleanup complete', {}, 'hackrf-cleanup-complete');
	} catch (error) {
		logError('Cleanup failed', { error }, 'hackrf-cleanup-failed');
	}
}
