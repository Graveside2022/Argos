/**
 * Lifecycle helpers for SweepManager — startup validation and event emission.
 * Extracted to keep sweep-manager.ts under 300 LOC.
 */
import type { EventEmitter } from 'events';

import type { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import {
	type CyclingHealth,
	forceCleanupExistingProcesses
} from '$lib/hackrf/sweep-manager/sweep-health-checker';
import { SystemStatus } from '$lib/types/enums';
import { logger } from '$lib/utils/logger';

import type { SweepMutableState } from './types';

/** Dependencies for startup validation. */
export interface StartupValidationDeps {
	mutableState: SweepMutableState;
	processManager: ProcessManager;
	frequencyCycler: FrequencyCycler;
	bufferManager: BufferManager;
	errorTracker: ErrorTracker;
	cyclingHealth: CyclingHealth;
}

/** Perform startup state validation — resets all subsystems to idle. */
export async function performStartupValidation(deps: StartupValidationDeps): Promise<void> {
	logger.info('[SEARCH] SweepManager: Performing startup state validation...');
	deps.mutableState.isRunning = false;
	deps.mutableState.status = { state: SystemStatus.Idle };
	await forceCleanupExistingProcesses(deps.processManager);
	await deps.processManager.cleanup();
	deps.frequencyCycler.resetCycling();
	deps.bufferManager.clearBuffer();
	deps.errorTracker.resetErrorTracking();
	const rs = deps.errorTracker.getRecoveryStatus();
	Object.assign(deps.cyclingHealth, {
		status: SystemStatus.Idle,
		processHealth: 'stopped',
		lastDataReceived: null
	});
	Object.assign(deps.cyclingHealth.recovery, {
		recoveryAttempts: rs.recoveryAttempts,
		lastRecoveryAttempt: rs.lastRecoveryAttempt,
		isRecovering: rs.isRecovering
	});
	deps.mutableState.isInitialized = true;
	logger.info('[OK] SweepManager startup validation complete');
}

/** Dependencies for event emission. */
export interface EventEmissionDeps {
	sseEmitter: ((event: string, data: unknown) => void) | null;
	eventEmitter: EventEmitter;
}

/** Emit an event to both the SSE emitter and the EventEmitter. */
export function emitSweepEvent(
	deps: EventEmissionDeps,
	event: string,
	data: unknown
): {
	sseEmitter: ((event: string, data: unknown) => void) | null;
} {
	if (deps.sseEmitter) {
		try {
			deps.sseEmitter(event, data);
		} catch (error) {
			logger.warn('SSE emitter error, clearing reference', { error });
			deps.sseEmitter = null;
		}
	}
	if (deps.eventEmitter.listenerCount(event) > 0) deps.eventEmitter.emit(event, data);
	return { sseEmitter: deps.sseEmitter };
}

/** Emit a typed error event with timestamp and stack details. */
export function emitSweepError(
	deps: EventEmissionDeps,
	message: string,
	type: string,
	error?: Error
): { sseEmitter: ((event: string, data: unknown) => void) | null } {
	const result = emitSweepEvent(deps, 'error', {
		message,
		type,
		timestamp: new Date().toISOString(),
		details: error?.stack
	});
	logger.error(`[ERROR] ${type}: ${message}`, { type, details: error?.stack });
	return result;
}
