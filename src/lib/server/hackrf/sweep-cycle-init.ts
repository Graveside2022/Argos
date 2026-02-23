/** Cycle initialization and runtime frequency cycling extracted from SweepManager. */
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { convertToHz } from '$lib/hackrf/sweep-manager/frequency-utils';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import { forceCleanupExistingProcesses } from '$lib/hackrf/sweep-manager/sweep-health-checker';
import type { SweepMutableState } from '$lib/server/hackrf/types';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { SystemStatus } from '$lib/types/enums';
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

/** Wait for initialization, validate state, acquire hardware, then start. */
export async function startCycle(
	ctx: CycleInitContext,
	frequencies: Array<{ value: number; unit: string }>,
	cycleTime: number
): Promise<boolean> {
	if (!ctx.state.isInitialized) {
		logWarn('Service not yet initialized, waiting...');
		let waitTime = 0;
		while (!ctx.state.isInitialized && waitTime < 10000) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			waitTime += 500;
		}
		if (!ctx.state.isInitialized) {
			logError('Service failed to initialize within 10 seconds');
			return false;
		}
	}

	await ctx.processManager.cleanup();
	await new Promise((resolve) => setTimeout(resolve, 1000));

	if (ctx.state.isRunning) {
		const processState = ctx.processManager.getProcessState();
		if (
			processState.isRunning &&
			processState.actualProcessPid &&
			ctx.processManager.isProcessAlive(processState.actualProcessPid)
		) {
			ctx.emitError('Sweep is already running', 'state_check');
			return false;
		} else {
			logWarn('Detected stale running state, resetting...');
			ctx.state.isRunning = false;
			ctx.state.status = { state: SystemStatus.Idle };
			ctx.emitEvent('status', ctx.state.status);
		}
	}

	if (!frequencies || frequencies.length === 0) {
		ctx.emitError('No frequencies provided', 'input_validation');
		return false;
	}

	const acquireResult = await resourceManager.acquire('hackrf-sweep', HardwareDevice.HACKRF);
	if (!acquireResult.success) {
		ctx.emitError(
			`HackRF is in use by ${acquireResult.owner}. Stop it first.`,
			'resource_conflict'
		);
		return false;
	}

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
	await new Promise((resolve) => setTimeout(resolve, 2000));

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

/** Run the sweep process for the current frequency, set up cycle timer if multi-freq. */
export async function runNextFrequency(ctx: CycleRuntimeContext): Promise<void> {
	if (!ctx.state.isRunning) return;
	const cycleState = ctx.frequencyCycler.getCycleState();
	if (!cycleState.currentFrequency) return;
	try {
		await ctx.startSweepProcess(cycleState.currentFrequency);
		ctx.errorTracker.recordSuccess();
		if (cycleState.isCycling && cycleState.frequencyCount > 1) {
			ctx.frequencyCycler.startCycleTimer(() => {
				cycleToNextFrequency(ctx).catch((error) => {
					logError('Error cycling to next frequency', {
						error: error instanceof Error ? error.message : String(error)
					});
				});
			});
		}
	} catch (error: unknown) {
		const errorAnalysis = ctx.errorTracker.recordError(error as Error, {
			frequency: cycleState.currentFrequency?.value,
			operation: 'start_sweep'
		});
		logError('[ERROR] Error starting sweep process:', {
			error: (error as Error).message,
			analysis: errorAnalysis
		});
		await handleSweepError(
			ctx.getCoordinatorContext(),
			error as Error,
			cycleState.currentFrequency,
			() => ctx.stopSweep()
		);
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
