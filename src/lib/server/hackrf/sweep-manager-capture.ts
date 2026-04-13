import { logger } from '$lib/utils/logger';

import {
	handleProcessExit,
	handleSpectrumData,
	startSweepProcess,
	type SweepCoordinatorContext
} from './sweep-coordinator';
import { closeSweepLog, openSweepLog } from './sweep-persistence';
import type { SpectrumData, SweepArgs } from './types';

export interface StartSweepProcessDeps {
	getCoordinatorContext: () => SweepCoordinatorContext;
	getProcessHealth: () => string;
	onRecovery: (reason: string) => void;
	clearHealthMonitor: () => void;
}

export async function runStartSweepProcessWithArgs(
	deps: StartSweepProcessDeps,
	args: SweepArgs,
	frequency: { value: number; unit: string }
): Promise<void> {
	const ctx = deps.getCoordinatorContext();
	await startSweepProcess(
		ctx,
		args,
		frequency,
		(data: SpectrumData, freq: { value: number; unit: string }) => {
			handleSpectrumData(ctx, data, freq, deps.getProcessHealth());
		},
		(code: number | null, signal: string | null) => {
			handleProcessExit(ctx, code, signal, (reason: string) => {
				deps.onRecovery(reason);
			});
			deps.clearHealthMonitor();
		}
	);
}

export interface NarrowBandSweepParams {
	captureId: string;
	startHz: number;
	endHz: number;
	binHz: number;
}

export interface NarrowBandSweepDeps {
	isRunning: () => boolean;
	stopSweep: () => Promise<void>;
	setActiveCaptureId: (id: string | null) => void;
	startSweepProcessWithArgs: (
		args: SweepArgs,
		frequency: { value: number; unit: string }
	) => Promise<void>;
	markRunning: () => void;
}

async function safeStopSweep(stopSweep: () => Promise<void>, tag: string): Promise<void> {
	try {
		await stopSweep();
	} catch (error) {
		logger.warn(`${tag}: stopSweep failed, continuing`, {
			error: error instanceof Error ? error.message : String(error)
		});
	}
}

export async function runNarrowBandSweep(
	deps: NarrowBandSweepDeps,
	params: NarrowBandSweepParams
): Promise<void> {
	const { captureId, startHz, endHz, binHz } = params;
	if (deps.isRunning()) await safeStopSweep(deps.stopSweep, 'startNarrowBandSweep');
	openSweepLog(captureId, {
		startHz,
		endHz,
		binHz,
		capture_start_dtg: new Date().toISOString()
	});
	deps.setActiveCaptureId(captureId);
	const frequency = { value: (startHz + endHz) / 2, unit: 'Hz' };
	const args: SweepArgs = {
		startMHz: startHz / 1e6,
		endMHz: endHz / 1e6,
		binWidthHz: binHz
	};
	deps.markRunning();
	await deps.startSweepProcessWithArgs(args, frequency);
}

export interface CloseSweepLogDeps {
	getActiveCaptureId: () => string | null;
	setActiveCaptureId: (id: string | null) => void;
	stopSweep: () => Promise<void>;
}

export async function runCloseSweepLog(deps: CloseSweepLogDeps, captureId: string): Promise<void> {
	closeSweepLog(captureId);
	if (deps.getActiveCaptureId() !== captureId) return;
	deps.setActiveCaptureId(null);
	await safeStopSweep(deps.stopSweep, 'closeSweepLogForCapture');
}
