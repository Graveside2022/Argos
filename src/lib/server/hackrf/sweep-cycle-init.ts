/** Cycle initialization and runtime frequency cycling extracted from SweepManager. */
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { convertToHz } from '$lib/hackrf/sweep-manager/frequency-utils';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import { forceCleanupExistingProcesses } from '$lib/hackrf/sweep-manager/sweep-health-checker';
import { errMsg } from '$lib/server/api/error-utils';
import type { SweepMutableState } from '$lib/server/hackrf/types';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { SystemStatus } from '$lib/types/enums';
import { delay } from '$lib/utils/delay';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

import type { SweepCoordinatorContext } from './sweep-coordinator';
import { handleSweepError } from './sweep-coordinator';

/** Context passed from SweepManager into cycle init functions. */
export interface CycleInitContext {
	/** Mutable state object — mutations propagate back to SweepManager. */
	state: SweepMutableState;
	processManager: ProcessManager;
	frequencyCycler: FrequencyCycler;
	emitEvent: (event: string, data: unknown) => void;
	emitError: (message: string, type: string, error?: Error) => void;
	resetErrorTracking: () => void;
	runNextFrequency: () => Promise<void>;
}

/** Context for frequency runtime cycling operations. */
export interface CycleRuntimeContext {
	/** Mutable state object — mutations propagate back to SweepManager. */
	state: SweepMutableState;
	frequencyCycler: FrequencyCycler;
	processManager: ProcessManager;
	errorTracker: ErrorTracker;
	emitEvent: (event: string, data: unknown) => void;
	getCoordinatorContext: () => SweepCoordinatorContext;
	startSweepProcess: (freq: { value: number; unit: string }) => Promise<void>;
	stopSweep: () => Promise<void>;
}

/** Wait up to 10s for the service to finish initializing */
async function waitForInit(ctx: CycleInitContext): Promise<boolean> {
	if (ctx.state.isInitialized) return true;
	logWarn('Service not yet initialized, waiting...');
	let waitTime = 0;
	while (!ctx.state.isInitialized && waitTime < 10000) {
		await delay(500);
		waitTime += 500;
	}
	if (!ctx.state.isInitialized) {
		logError('Service failed to initialize within 10 seconds');
		return false;
	}
	return true;
}

/** If marked as running, check whether the process is truly alive or stale */
function checkStaleState(ctx: CycleInitContext): boolean {
	if (!ctx.state.isRunning) return true;
	const processState = ctx.processManager.getProcessState();
	const alive =
		processState.isRunning &&
		processState.actualProcessPid &&
		ctx.processManager.isProcessAlive(processState.actualProcessPid);
	if (alive) {
		ctx.emitError('Sweep is already running', 'state_check');
		return false;
	}
	logWarn('Detected stale running state, resetting...');
	ctx.state.isRunning = false;
	ctx.state.status = { state: SystemStatus.Idle };
	ctx.emitEvent('status', ctx.state.status);
	return true;
}

/** Acquire HackRF hardware resource */
async function acquireHardware(ctx: CycleInitContext): Promise<boolean> {
	const result = await resourceManager.acquire('hackrf-sweep', HardwareDevice.HACKRF);
	if (!result.success) {
		ctx.emitError(`HackRF is in use by ${result.owner}. Stop it first.`, 'resource_conflict');
		return false;
	}
	return true;
}

/** Validate that a non-empty frequency list was provided */
function hasFrequencies(
	ctx: CycleInitContext,
	frequencies: Array<{ value: number; unit: string }> | undefined
): boolean {
	if (frequencies && frequencies.length > 0) return true;
	ctx.emitError('No frequencies provided', 'input_validation');
	return false;
}

/** Run all pre-flight checks: init, cleanup, stale state, frequencies, hardware */
async function preflightChecks(
	ctx: CycleInitContext,
	frequencies: Array<{ value: number; unit: string }>
): Promise<boolean> {
	if (!(await waitForInit(ctx))) return false;
	await ctx.processManager.cleanup();
	await delay(1000);
	if (!checkStaleState(ctx)) return false;
	if (!hasFrequencies(ctx, frequencies)) return false;
	return acquireHardware(ctx);
}

/** Wait for initialization, validate state, acquire hardware, then start. */
export async function startCycle(
	ctx: CycleInitContext,
	frequencies: Array<{ value: number; unit: string }>,
	cycleTime: number
): Promise<boolean> {
	if (!(await preflightChecks(ctx, frequencies))) return false;
	try {
		return await initializeCycleAndRun(ctx, frequencies, cycleTime);
	} catch (error: unknown) {
		const err = error as Error;
		ctx.emitError(`Failed to start cycle: ${err.message}`, 'cycle_startup', err);
		return false;
	}
}

/** Validate frequencies, configure cycling, emit initial status, run first frequency. */
async function initializeCycleAndRun(
	ctx: CycleInitContext,
	frequencies: Array<{ value: number; unit: string }>,
	cycleTime: number
): Promise<boolean> {
	const validatedFreqs = ctx.frequencyCycler.normalizeFrequencies(frequencies);
	if (validatedFreqs.length === 0) {
		ctx.emitError('No valid frequencies provided', 'frequency_validation');
		return false;
	}

	await forceCleanupExistingProcesses(ctx.processManager);
	await delay(2000);

	logInfo(
		'[SEARCH] Using auto_sweep.sh for device detection (supports HackRF and USRP B205 mini)...'
	);

	ctx.frequencyCycler.initializeCycling({
		frequencies: validatedFreqs,
		cycleTime: cycleTime || 10000,
		switchingTime: 1000
	});

	ctx.state.isRunning = true;
	ctx.resetErrorTracking();

	ctx.state.status = {
		state: SystemStatus.Running,
		currentFrequency: convertToHz(validatedFreqs[0].value, validatedFreqs[0].unit),
		sweepProgress: 0,
		totalSweeps: validatedFreqs.length,
		completedSweeps: 0,
		startTime: Date.now()
	};

	ctx.emitEvent('status', ctx.state.status);
	const currentCycleState = ctx.frequencyCycler.getCycleState();
	ctx.emitEvent('cycle_config', {
		frequencies: currentCycleState.frequencies,
		cycleTime: currentCycleState.cycleTime,
		totalCycleTime: currentCycleState.frequencies.length * currentCycleState.cycleTime,
		isCycling: currentCycleState.isCycling
	});

	try {
		await ctx.runNextFrequency();
		return true;
	} catch (runError: unknown) {
		const error = runError as Error;
		logError('[ERROR] Error in _runNextFrequency:', { error: error.message });
		if (error.stack) logError('Stack:', { stack: error.stack });
		return true;
	}
}

/** Whether cycling should start a timer for the next frequency */
function shouldStartCycleTimer(cycleState: {
	isCycling: boolean;
	frequencyCount: number;
}): boolean {
	return cycleState.isCycling && cycleState.frequencyCount > 1;
}

/** Handle a sweep start error: record, log, and delegate to error handler */
async function handleRunError(
	ctx: CycleRuntimeContext,
	error: unknown,
	currentFrequency: { value: number; unit: string }
): Promise<void> {
	const errorAnalysis = ctx.errorTracker.recordError(error as Error, {
		frequency: currentFrequency.value,
		operation: 'start_sweep'
	});
	logError('[ERROR] Error starting sweep process:', {
		error: errMsg(error),
		analysis: errorAnalysis
	});
	await handleSweepError(ctx.getCoordinatorContext(), error as Error, currentFrequency, () =>
		ctx.stopSweep()
	);
}

/** Run the sweep process for the current frequency, set up cycle timer if multi-freq. */
export async function runNextFrequency(ctx: CycleRuntimeContext): Promise<void> {
	if (!ctx.state.isRunning) return;
	const cycleState = ctx.frequencyCycler.getCycleState();
	if (!cycleState.currentFrequency) return;
	try {
		await ctx.startSweepProcess(cycleState.currentFrequency);
		ctx.errorTracker.recordSuccess();
		if (shouldStartCycleTimer(cycleState)) {
			ctx.frequencyCycler.startCycleTimer(() => {
				cycleToNextFrequency(ctx).catch((error) => {
					logError('Error cycling to next frequency', {
						error: error instanceof Error ? error.message : String(error)
					});
				});
			});
		}
	} catch (error: unknown) {
		await handleRunError(ctx, error, cycleState.currentFrequency);
	}
}

/** Switch to the next frequency in the cycle and restart sweep. */
export async function cycleToNextFrequency(ctx: CycleRuntimeContext): Promise<void> {
	const cycleState = ctx.frequencyCycler.getCycleState();
	if (!cycleState.isCycling || !ctx.state.isRunning) return;
	await ctx.frequencyCycler.cycleToNext(async (nextFreq) => {
		ctx.emitEvent('status_change', { status: 'switching', nextFrequency: nextFreq });
	});
	const processState = ctx.processManager.getProcessState();
	await ctx.processManager.stopProcess(processState);
	ctx.frequencyCycler.startSwitchTimer(() => {
		runNextFrequency(ctx).catch((error) => {
			logError('Error running next frequency', {
				error: error instanceof Error ? error.message : String(error)
			});
		});
	});
}
