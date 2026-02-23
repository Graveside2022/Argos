/**
 * Process lifecycle helpers for HackRF sweep process management
 * Handles stopping, force-killing, and cleanup of HackRF processes
 */

import { type ChildProcess, execFile } from 'child_process';

import { logError, logInfo, logWarn } from '$lib/utils/logger';

import type { ProcessState } from './process-manager';

/**
 * Stop a specific process with graceful SIGTERM then SIGKILL fallback
 */
export async function stopProcess(
	processState: ProcessState,
	processRegistry: Map<number, ChildProcess>
): Promise<void> {
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
		if (processState.actualProcessPid) {
			await sendTermSignal(processState.actualProcessPid);
			await new Promise((resolve) => setTimeout(resolve, 100));
			await forceKillIfAlive(processState.actualProcessPid);
		}

		killProcessGroup(processState);
	} catch (error) {
		logError('Error during process termination', { error }, 'process-termination-error');
	}

	if (processState.actualProcessPid) {
		processRegistry.delete(processState.actualProcessPid);
	}

	await pkillHackrfSweep();
	await new Promise((resolve) => setTimeout(resolve, 500));
}

/** Send SIGTERM to a process */
async function sendTermSignal(pid: number): Promise<void> {
	try {
		process.kill(pid, 'SIGTERM');
		logInfo('Sent SIGTERM to process', { pid }, 'process-sigterm-sent');
	} catch (_error: unknown) {
		logWarn('Process already dead or SIGTERM failed', { pid }, 'process-sigterm-failed');
	}
}

/** Check if process is alive and force kill if so */
async function forceKillIfAlive(pid: number): Promise<void> {
	try {
		process.kill(pid, 0);
		logWarn('Process still alive, sending SIGKILL', { pid }, 'process-sigkill-needed');
		process.kill(pid, 'SIGKILL');
	} catch (_error: unknown) {
		logInfo('Process terminated successfully', { pid }, 'process-terminated');
	}
}

/** Kill the entire process group if using detached mode */
function killProcessGroup(processState: ProcessState): void {
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
			logError(
				'Process group kill failed',
				{ error: e, pgid: processState.sweepProcessPgid },
				'process-group-kill-failed'
			);
		}
	}
}

/** Run pkill -9 -x hackrf_sweep as backup cleanup */
async function pkillHackrfSweep(): Promise<void> {
	try {
		await new Promise<void>((resolve) => {
			execFile('/usr/bin/pkill', ['-9', '-x', 'hackrf_sweep'], (error) => {
				if (error && error.code !== 1) {
					logError('pkill error', { error }, 'pkill-error');
				}
				resolve();
			});
		});
	} catch (e) {
		logError('Failed to run pkill', { error: e }, 'pkill-failed');
	}
}

/**
 * Force cleanup all HackRF-related processes system-wide
 */
export async function forceCleanupAllProcesses(
	processRegistry: Map<number, ChildProcess>
): Promise<void> {
	logInfo('Force cleaning up existing HackRF processes', {}, 'hackrf-cleanup-start');

	const pkill = (args: string[]) =>
		new Promise<void>((resolve) => {
			execFile('/usr/bin/pkill', args, () => resolve());
		});

	try {
		await pkill(['-9', '-x', 'hackrf_sweep']);
		await pkill(['-9', '-f', 'hackrf_info']);
		await pkill(['-9', '-f', 'usrp_spectrum_scan.py']);
		await pkill(['-9', '-f', 'python.*usrp']);
		await pkill(['-9', '-f', 'mock_sweep.sh']);
		await pkill(['-9', '-f', 'auto_sweep.sh']);

		processRegistry.clear();
		await new Promise((resolve) => setTimeout(resolve, 1000));

		logInfo('Cleanup complete', {}, 'hackrf-cleanup-complete');
	} catch (error) {
		logError('Cleanup failed', { error }, 'hackrf-cleanup-failed');
	}
}

function forceKillSingleProcess(pid: number, childProcess: ChildProcess): void {
	try {
		if (childProcess && !childProcess.killed) {
			childProcess.kill('SIGKILL');
		}
		process.kill(pid, 'SIGKILL');
		logInfo(`Force killed PID: ${pid}`);
	} catch (_error: unknown) {
		logInfo('Process already dead or kill failed');
	}
}

/**
 * Force kill all registered processes and cleanup
 */
export async function forceKillAllProcesses(
	processRegistry: Map<number, ChildProcess>
): Promise<void> {
	for (const [pid, childProcess] of processRegistry) {
		forceKillSingleProcess(pid, childProcess);
	}

	processRegistry.clear();
	await forceCleanupAllProcesses(processRegistry);
	logInfo('[OK] Force process kill completed');
}
