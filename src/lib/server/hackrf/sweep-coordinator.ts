import type { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { convertToMHz } from '$lib/hackrf/sweep-manager/frequency-utils';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import { isCriticalError } from '$lib/hackrf/sweep-manager/sweep-utils';
import { normalizeError } from '$lib/server/api/error-utils';
import { logger } from '$lib/utils/logger';

import { appendFrame } from './sweep-persistence';
import type { SpectrumData, SweepArgs } from './types';

/** Context passed to coordinator functions from SweepManager. */
export interface SweepCoordinatorContext {
	readonly processManager: ProcessManager;
	readonly frequencyCycler: FrequencyCycler;
	readonly bufferManager: BufferManager;
	readonly errorTracker: ErrorTracker;
	emitEvent: (event: string, data: unknown) => void;
	emitError: (message: string, type: string, error?: Error) => void;
	updateCyclingHealth: (update: CyclingHealthUpdate) => void;
	readonly isRunning: boolean;
	activeCaptureId?: string | null;
}

export interface CyclingHealthUpdate {
	lastDataReceived?: Date;
	processHealth?: string;
}

export function sweepArgsFromCenter(frequency: { value: number; unit: string }): SweepArgs {
	const centerMHz = convertToMHz(frequency.value, frequency.unit);
	return { startMHz: centerMHz - 10, endMHz: centerMHz + 10, binWidthHz: 20000 };
}

function buildHackrfArgs(sweepArgs: SweepArgs): string[] {
	const { startMHz, endMHz, binWidthHz } = sweepArgs;
	const centerFreqMHz = (startMHz + endMHz) / 2;
	const gains = selectGains(centerFreqMHz);
	const lnaGain = sweepArgs.lnaGain ?? gains.lnaGain;
	const vgaGain = sweepArgs.vgaGain ?? gains.vgaGain;
	return [
		'-f',
		`${Math.floor(startMHz)}:${Math.ceil(endMHz)}`,
		'-g',
		vgaGain,
		'-l',
		lnaGain,
		'-w',
		String(binWidthHz),
		'-P',
		'estimate',
		'-n'
	];
}

function makeStdoutHandler(
	ctx: SweepCoordinatorContext,
	frequency: { value: number; unit: string },
	onSpectrumData: (data: SpectrumData, freq: { value: number; unit: string }) => void
): (data: Buffer) => void {
	return (data: Buffer) => {
		ctx.bufferManager.processDataChunk(data, (parsedLine) => {
			if (parsedLine.isValid && parsedLine.data) {
				onSpectrumData(parsedLine.data, frequency);
				return;
			}
			if (parsedLine.parseError) {
				logger.warn(
					'Failed to parse spectrum line',
					{ error: parsedLine.parseError, line: parsedLine.rawLine.substring(0, 100) },
					'sweep-parse-error'
				);
			}
		});
	};
}

function makeStderrHandler(
	ctx: SweepCoordinatorContext,
	frequency: { value: number; unit: string }
): (data: Buffer) => void {
	return (data: Buffer) => {
		const message = data.toString().trim();
		logger.warn('Process stderr', { message });
		if (isCriticalError(message)) {
			ctx.errorTracker.recordError(message, {
				frequency: frequency.value,
				operation: 'sweep_process'
			});
		}
	};
}

/**
 * Starts a hackrf_sweep process for a given sweep-arg window.
 * Handles argument construction, gain selection, and process event wiring.
 */
export async function startSweepProcess(
	ctx: SweepCoordinatorContext,
	sweepArgs: SweepArgs,
	frequency: { value: number; unit: string },
	onSpectrumData: (data: SpectrumData, freq: { value: number; unit: string }) => void,
	onProcessExit: (code: number | null, signal: string | null) => void
): Promise<void> {
	const { startMHz, endMHz, binWidthHz } = sweepArgs;
	if (startMHz < 1 || endMHz > 7250) {
		throw new Error(`Frequency window ${startMHz}-${endMHz} MHz out of range (1-7250 MHz)`);
	}
	try {
		const args = buildHackrfArgs(sweepArgs);
		logger.info(`[START] Starting hackrf_sweep for ${(startMHz + endMHz) / 2} MHz`);
		logger.info(`[INFO] Command: hackrf_sweep ${args.join(' ')}`);
		ctx.bufferManager.clearBuffer();
		ctx.processManager.setEventHandlers({
			onStdout: makeStdoutHandler(ctx, frequency, onSpectrumData),
			onStderr: makeStderrHandler(ctx, frequency),
			onExit: (code: number | null, signal: string | null) => {
				logger.info('Process exited', { code, signal });
				onProcessExit(code, signal);
			}
		});
		await ctx.processManager.spawnSweepProcess(args, {
			detached: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			startupTimeoutMs: 5000
		});
		logger.info('[OK] HackRF sweep process started successfully', {
			centerFreq: `${frequency.value} ${frequency.unit}`,
			range: `${startMHz} - ${endMHz} MHz`,
			binWidthHz
		});
	} catch (error) {
		const analysis = ctx.errorTracker.recordError(normalizeError(error), {
			frequency: frequency.value,
			operation: 'start_process'
		});
		logger.error('Failed to start sweep process', {
			error: error instanceof Error ? error.message : String(error),
			analysis
		});
		throw error;
	}
}

/** Selects VGA and LNA gains based on frequency. */
function selectGains(centerFreqMHz: number): { vgaGain: string; lnaGain: string } {
	if (centerFreqMHz > 5000) {
		return { vgaGain: '30', lnaGain: '40' };
	}
	return { vgaGain: '20', lnaGain: '32' };
}

interface FramePayload {
	t: string;
	f0: number;
	f1: number;
	bw: number;
	bins: number[];
}

function extractBins(data: SpectrumData): ArrayLike<number> | null {
	const bins = data.powerValues ?? data.binData;
	if (!bins || bins.length === 0) return null;
	return bins;
}

function extractFreqWindow(data: SpectrumData): { f0: number; f1: number } | null {
	const { startFreq, endFreq } = data;
	if (startFreq === undefined || endFreq === undefined) return null;
	return { f0: startFreq * 1e6, f1: endFreq * 1e6 };
}

function extractTimestamp(data: SpectrumData): string {
	return data.timestamp instanceof Date ? data.timestamp.toISOString() : new Date().toISOString();
}

function buildFramePayload(data: SpectrumData): FramePayload | null {
	const bins = extractBins(data);
	if (!bins) return null;
	const window = extractFreqWindow(data);
	if (!window) return null;
	const bw = typeof data.metadata?.binWidth === 'number' ? data.metadata.binWidth : 0;
	return { t: extractTimestamp(data), f0: window.f0, f1: window.f1, bw, bins: Array.from(bins) };
}

function persistFrame(captureId: string, data: SpectrumData): void {
	const payload = buildFramePayload(data);
	if (payload) appendFrame(captureId, payload);
}

function processValidatedSpectrum(
	ctx: SweepCoordinatorContext,
	data: SpectrumData,
	frequency: { value: number; unit: string },
	currentProcessHealth: string
): void {
	ctx.updateCyclingHealth({ lastDataReceived: new Date() });
	if (ctx.activeCaptureId) persistFrame(ctx.activeCaptureId, data);
	ctx.emitEvent('spectrum_data', { frequency, data, timestamp: data.timestamp });
	if (currentProcessHealth !== 'running') {
		ctx.updateCyclingHealth({ processHealth: 'running' });
		ctx.emitEvent('status_change', { status: 'running' });
	}
}

/** Handles validated spectrum data, updating health and emitting events. */
export function handleSpectrumData(
	ctx: SweepCoordinatorContext,
	data: SpectrumData,
	frequency: { value: number; unit: string },
	currentProcessHealth: string
): void {
	try {
		const validation = ctx.bufferManager.validateSpectrumData(data);
		if (!validation.isValid) {
			logger.warn(
				'Invalid spectrum data received',
				{ issues: validation.issues },
				'invalid-spectrum'
			);
			return;
		}
		processValidatedSpectrum(ctx, data, frequency, currentProcessHealth);
	} catch (error) {
		logger.error('Error handling spectrum data', {
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

/** Handles process exit, triggering recovery if appropriate. */
export function handleProcessExit(
	ctx: SweepCoordinatorContext,
	code: number | null,
	signal: string | null,
	performRecoveryFn: (reason: string) => void
): void {
	ctx.updateCyclingHealth({ processHealth: 'stopped' });
	const exitAnalysis = ctx.errorTracker.recordError(
		`Process exited with code ${code}, signal ${signal}`,
		{ operation: 'process_exit' }
	);

	logger.info('Process exit handled by services', {
		code,
		signal,
		analysis: exitAnalysis,
		wasRunning: ctx.isRunning
	});

	ctx.processManager.cleanup();

	const cycleState = ctx.frequencyCycler.getCycleState();
	if (ctx.isRunning && !cycleState.inFrequencyTransition) {
		ctx.emitError(
			`HackRF process terminated unexpectedly: ${exitAnalysis.recommendedAction}`,
			'process_died'
		);
		if (ctx.errorTracker.shouldAttemptRecovery()) {
			performRecoveryFn(`Process died: ${exitAnalysis.recommendedAction}`);
		}
	}
}

/** Handles sweep errors, blacklisting frequencies and stopping if needed. */
export async function handleSweepError(
	ctx: SweepCoordinatorContext,
	error: Error,
	frequency: { value: number; unit: string },
	stopSweep: () => Promise<void>
): Promise<void> {
	const errorAnalysis = ctx.errorTracker.recordError(error, {
		frequency: frequency.value,
		operation: 'sweep_error'
	});

	logger.error('Sweep error analyzed by ErrorTracker', {
		error: error.message,
		frequency,
		analysis: errorAnalysis
	});

	if (ctx.errorTracker.shouldBlacklistFrequency(frequency.value)) {
		ctx.frequencyCycler.blacklistFrequency(frequency);
		logger.warn('Frequency blacklisted by ErrorTracker', { frequency });
	}

	ctx.emitError(error.message, 'sweep_error', error);

	if (ctx.errorTracker.hasMaxConsecutiveErrors() || ctx.errorTracker.hasMaxFailuresPerMinute()) {
		logger.error('ErrorTracker recommends stopping sweep', {
			analysis: errorAnalysis,
			recommendedAction: errorAnalysis.recommendedAction
		});
		await stopSweep();
	}
}

export { testHackrfAvailability } from './hackrf-availability';
