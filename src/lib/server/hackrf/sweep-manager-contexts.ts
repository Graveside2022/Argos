import type { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import type {
	CyclingHealth,
	HealthCheckContext
} from '$lib/hackrf/sweep-manager/sweep-health-checker';

import type { CyclingHealthUpdate, SweepCoordinatorContext } from './sweep-coordinator';
import type { CycleInitContext, CycleRuntimeContext } from './sweep-cycle-init';
import type { SweepMutableState } from './types';

export interface ManagerDeps {
	readonly mutableState: SweepMutableState;
	readonly processManager: ProcessManager;
	readonly frequencyCycler: FrequencyCycler;
	readonly bufferManager: BufferManager;
	readonly errorTracker: ErrorTracker;
	readonly cyclingHealth: CyclingHealth;
	readonly getActiveCaptureId: () => string | null;
	readonly emitEvent: (event: string, data: unknown) => void;
	readonly emitError: (message: string, type: string, error?: Error) => void;
	readonly runNextFrequency: () => Promise<void>;
	readonly startSweepProcess: (freq: { value: number; unit: string }) => Promise<void>;
	readonly stopSweep: () => Promise<void>;
}

function applyHealthUpdate(cyclingHealth: CyclingHealth, update: CyclingHealthUpdate): void {
	if (update.lastDataReceived !== undefined)
		cyclingHealth.lastDataReceived = update.lastDataReceived;
	if (update.processHealth !== undefined) cyclingHealth.processHealth = update.processHealth;
}

export function buildCoordinatorContext(deps: ManagerDeps): SweepCoordinatorContext {
	return {
		processManager: deps.processManager,
		frequencyCycler: deps.frequencyCycler,
		bufferManager: deps.bufferManager,
		errorTracker: deps.errorTracker,
		emitEvent: (event, data) => deps.emitEvent(event, data),
		emitError: (msg, type, err) => deps.emitError(msg, type, err),
		updateCyclingHealth: (update) => applyHealthUpdate(deps.cyclingHealth, update),
		isRunning: deps.mutableState.isRunning,
		activeCaptureId: deps.getActiveCaptureId()
	};
}

export function buildHealthContext(deps: ManagerDeps): HealthCheckContext {
	return {
		...buildCoordinatorContext(deps),
		cyclingHealth: deps.cyclingHealth,
		startSweepProcess: deps.startSweepProcess,
		stopSweep: deps.stopSweep
	};
}

export function buildCycleInitContext(
	deps: ManagerDeps,
	resetErrorTracking: () => void
): CycleInitContext {
	return {
		state: deps.mutableState,
		processManager: deps.processManager,
		frequencyCycler: deps.frequencyCycler,
		emitEvent: (event: string, data: unknown) => deps.emitEvent(event, data),
		emitError: (msg: string, type: string, err?: Error) => deps.emitError(msg, type, err),
		resetErrorTracking,
		runNextFrequency: deps.runNextFrequency
	};
}

export function buildCycleRuntimeContext(deps: ManagerDeps): CycleRuntimeContext {
	return {
		state: deps.mutableState,
		frequencyCycler: deps.frequencyCycler,
		processManager: deps.processManager,
		errorTracker: deps.errorTracker,
		emitEvent: (event, data) => deps.emitEvent(event, data),
		getCoordinatorContext: () => buildCoordinatorContext(deps),
		startSweepProcess: deps.startSweepProcess,
		stopSweep: deps.stopSweep
	};
}
