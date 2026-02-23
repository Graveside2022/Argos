import { execFile } from 'child_process';

import type { BufferManager } from '$lib/hackrf/sweep-manager/buffer-manager';
import type { ErrorTracker } from '$lib/hackrf/sweep-manager/error-tracker';
import type { FrequencyCycler } from '$lib/hackrf/sweep-manager/frequency-cycler';
import { convertToMHz } from '$lib/hackrf/sweep-manager/frequency-utils';
import type { ProcessManager } from '$lib/hackrf/sweep-manager/process-manager';
import { isCriticalError } from '$lib/hackrf/sweep-manager/sweep-utils';
import { logError, logInfo, logWarn } from '$lib/utils/logger';

import type { SpectrumData } from './types';

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
}

export interface CyclingHealthUpdate {
	lastDataReceived?: Date;
	processHealth?: string;
}

/**
 * Starts a hackrf_sweep process for a given frequency.
 * Handles argument construction, gain selection, and process event wiring.
 */
export async function startSweepProcess(
	ctx: SweepCoordinatorContext,
	frequency: { value: number; unit: string },
	onSpectrumData: (data: SpectrumData, freq: { value: number; unit: string }) => void,
	onProcessExit: (code: number | null, signal: string | null) => void
): Promise<void> {
	try {
		const centerFreqMHz = convertToMHz(frequency.value, frequency.unit);
		const rangeMHz = 10;
		const freqMinMHz = centerFreqMHz - rangeMHz;
		const freqMaxMHz = centerFreqMHz + rangeMHz;

		if (freqMinMHz < 1 || freqMaxMHz > 7250) {
			throw new Error(`Frequency ${centerFreqMHz} MHz out of range (1-7250 MHz)`);
		}

		const { vgaGain, lnaGain } = selectGains(centerFreqMHz);

		const args = [
			'-f',
			`${Math.floor(freqMinMHz)}:${Math.ceil(freqMaxMHz)}`,
			'-g',
			vgaGain,
			'-l',
			lnaGain,
			'-w',
			'20000',
			'-n'
		];

		logInfo(`[START] Starting hackrf_sweep for ${centerFreqMHz} MHz`);
		logInfo(`[INFO] Command: hackrf_sweep ${args.join(' ')}`);

		ctx.bufferManager.clearBuffer();

		const handleStdout = (data: Buffer) => {
			ctx.bufferManager.processDataChunk(data, (parsedLine) => {
				if (parsedLine.isValid && parsedLine.data) {
					onSpectrumData(parsedLine.data, frequency);
				} else if (parsedLine.parseError) {
					logWarn(
						'Failed to parse spectrum line',
						{
							error: parsedLine.parseError,
							line: parsedLine.rawLine.substring(0, 100)
						},
						'sweep-parse-error'
					);
				}
			});
		};

		const handleStderr = (data: Buffer) => {
			const message = data.toString().trim();
			logWarn('Process stderr', { message });
			if (isCriticalError(message)) {
				ctx.errorTracker.recordError(message, {
					frequency: frequency.value,
					operation: 'sweep_process'
				});
			}
		};

		ctx.processManager.setEventHandlers({
			onStdout: handleStdout,
			onStderr: handleStderr,
			onExit: (code: number | null, signal: string | null) => {
				logInfo('Process exited', { code, signal });
				onProcessExit(code, signal);
			}
		});

		await ctx.processManager.spawnSweepProcess(args, {
			detached: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			startupTimeoutMs: 5000
		});

		logInfo('[OK] HackRF sweep process started successfully', {
			centerFreq: `${frequency.value} ${frequency.unit}`,
			range: `${freqMinMHz} - ${freqMaxMHz} MHz`
		});
	} catch (error) {
		const analysis = ctx.errorTracker.recordError(error as Error, {
			frequency: frequency.value,
			operation: 'start_process'
		});
		logError('Failed to start sweep process', {
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
			logWarn(
				'Invalid spectrum data received',
				{ issues: validation.issues },
				'invalid-spectrum'
			);
			return;
		}
		ctx.updateCyclingHealth({ lastDataReceived: new Date() });
		ctx.emitEvent('spectrum_data', { frequency, data, timestamp: data.timestamp });
		if (currentProcessHealth !== 'running') {
			ctx.updateCyclingHealth({ processHealth: 'running' });
			ctx.emitEvent('status_change', { status: 'running' });
		}
	} catch (error) {
		logError('Error handling spectrum data', {
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

	logInfo('Process exit handled by services', {
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

	logError('Sweep error analyzed by ErrorTracker', {
		error: error.message,
		frequency,
		analysis: errorAnalysis
	});

	if (ctx.errorTracker.shouldBlacklistFrequency(frequency.value)) {
		ctx.frequencyCycler.blacklistFrequency(frequency);
		logWarn('Frequency blacklisted by ErrorTracker', { frequency });
	}

	ctx.emitError(error.message, 'sweep_error', error);

	if (ctx.errorTracker.hasMaxConsecutiveErrors() || ctx.errorTracker.hasMaxFailuresPerMinute()) {
		logError('ErrorTracker recommends stopping sweep', {
			analysis: errorAnalysis,
			recommendedAction: errorAnalysis.recommendedAction
		});
		await stopSweep();
	}
}

/** Tests HackRF hardware availability by running hackrf_info. */
export function testHackrfAvailability(): Promise<{
	available: boolean;
	reason: string;
	deviceInfo?: string;
}> {
	return new Promise((resolve) => {
		execFile('/usr/bin/timeout', ['3', 'hackrf_info'], (error, stdout, stderr) => {
			if (error) {
				resolve({
					available: false,
					reason:
						error.code === 124
							? 'Device check timeout'
							: `Device check failed: ${error.message}`
				});
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
