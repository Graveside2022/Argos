/**
 * GSM Intelligent Scan — single-frequency test and capture
 *
 * Spawns grgsm_livemon_headless on one frequency, runs parallel
 * tcpdump + tshark captures, and returns a FrequencyTestResult
 * with cell identity and signal classification.
 */

import { unlink } from 'fs/promises';
import path from 'path';

import { errMsg } from '$lib/server/api/error-utils';
import { env } from '$lib/server/env';
import { validatePathWithinDir } from '$lib/server/security/input-sanitizer';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { delay } from '$lib/utils/delay';
import { logger } from '$lib/utils/logger';
import { validateGain } from '$lib/validators/gsm';

import { readFrameHexLines, spawnGrgsm, verifyProcessAlive } from './gsm-grgsm-process';
import {
	appendCellIdentityEvents,
	appendChannelEvents,
	buildFailedResult,
	captureTcpdump,
	captureTshark,
	cleanupProcess
} from './gsm-scan-capture';
import type { ScanEvent } from './gsm-scan-types';
import { createResultEvent, createUpdateEvent } from './gsm-scan-types';
import {
	analyzeGsmFrames,
	classifySignalStrength,
	determineChannelType,
	parseCellIdentity
} from './protocol-parser';

/** Outcome of testing a single frequency */
export interface FrequencyTestOutcome {
	result: FrequencyTestResult;
	events: ScanEvent[];
}

/** Check whether frame analysis should be skipped (already have complete cell identity) */
function shouldSkipFrameAnalysis(
	frameCount: number,
	cellMcc: string,
	cellLac: string,
	cellCi: string
): boolean {
	if (frameCount <= 0) return true;
	return Boolean(cellMcc && cellLac && cellCi);
}

/** Analyse channel from frame hex log, returning null on error */
async function analyzeFrameLog(
	stderrLog: string,
	frameCount: number,
	cellMcc: string,
	cellLac: string,
	cellCi: string
): Promise<import('./protocol-parser').ChannelAnalysis | null> {
	if (shouldSkipFrameAnalysis(frameCount, cellMcc, cellLac, cellCi)) return null;
	try {
		return analyzeGsmFrames(await readFrameHexLines(stderrLog), frameCount);
	} catch {
		return null;
	}
}

/** Emit summary events for the frequency result */
function emitResultEvents(
	events: ScanEvent[],
	label: string,
	frameCount: number,
	strength: string,
	channelType: string,
	controlChannel: boolean
): void {
	const hasActivity = frameCount > 10;
	events.push(
		createUpdateEvent(
			`${label} Result: ${frameCount} GSM frames detected ${hasActivity ? '(active)' : '(no activity)'}`
		)
	);
	events.push(createUpdateEvent(`${label} Signal: ${frameCount} frames (${strength})`));
	if (channelType) {
		events.push(
			createUpdateEvent(
				`${label} Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`
			)
		);
	}
	events.push(createUpdateEvent('[SCAN] '));
}

/** Build the final FrequencyTestResult and push the result event */
function buildAndEmitResult(
	events: ScanEvent[],
	freq: string,
	frameCount: number,
	strength: string,
	channelType: string,
	controlChannel: boolean,
	cellId: import('./protocol-parser').CellIdentity,
	index: number,
	total: number
): FrequencyTestResult {
	const frequencyResult: FrequencyTestResult = {
		frequency: freq,
		power: -100,
		frameCount,
		hasGsmActivity: frameCount > 10,
		strength,
		channelType,
		controlChannel,
		mcc: cellId.mcc,
		mnc: cellId.mnc,
		lac: cellId.lac,
		ci: cellId.ci
	};
	events.push(
		createResultEvent({
			type: 'frequency_result',
			frequency: freq,
			result: frequencyResult,
			progress: { current: index + 1, total, completed: index + 1 }
		})
	);
	return frequencyResult;
}

/** Handle a frequency test error and return a failed outcome */
function handleTestError(
	events: ScanEvent[],
	label: string,
	freq: string,
	error: unknown,
	index: number,
	total: number
): FrequencyTestOutcome {
	events.push(createUpdateEvent(`${label} Error testing ${freq} MHz: ${errMsg(error)}`));
	events.push(createUpdateEvent(`${label} Skipping to next frequency...`));
	events.push(createUpdateEvent('[SCAN] '));
	const failedResult = buildFailedResult(freq);
	events.push(
		createResultEvent({
			type: 'frequency_result',
			frequency: freq,
			result: failedResult,
			progress: { current: index + 1, total, completed: index + 1 }
		})
	);
	return { result: failedResult, events };
}

/** Clean up stderr log file (best-effort) */
async function removeStderrLog(stderrLog: string): Promise<void> {
	try {
		await unlink(stderrLog);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: rm stderr log failed (non-critical)', {
			error: String(error)
		});
	}
}

export async function testFrequency(
	freq: string,
	index: number,
	total: number
): Promise<FrequencyTestOutcome> {
	const events: ScanEvent[] = [];
	const label = `[FREQ ${index + 1}/${total}]`;
	let pid = '';
	const stderrLog = path.join(env.ARGOS_TEMP_DIR, `grgsm_scan_${Date.now()}_${index}.log`);
	validatePathWithinDir(stderrLog, '/tmp');

	try {
		const validatedGain = validateGain(40);
		events.push(createUpdateEvent(`${label} Testing ${freq} MHz...`));
		events.push(createUpdateEvent(`[DEVICE] Using HackRF`));

		pid = spawnGrgsm(freq, validatedGain, stderrLog);
		events.push(
			createUpdateEvent(
				`${label} Process started (PID ${pid}), waiting for demodulator initialization...`
			)
		);
		await delay(2500);
		await verifyProcessAlive(pid, stderrLog);

		const captureTime = 15;
		events.push(
			createUpdateEvent(
				`${label} Capturing GSMTAP packets for ${captureTime}s (extended for System Information)...`
			)
		);

		const [tcpdumpResult, tsharkResult] = await Promise.all([
			captureTcpdump(captureTime),
			captureTshark(captureTime)
		]);

		const frameCount = parseInt(String(tcpdumpResult).trim()) || 0;
		const cellId = parseCellIdentity(String(tsharkResult));
		appendCellIdentityEvents(
			events,
			label,
			tsharkResult,
			cellId.mcc,
			cellId.mnc,
			cellId.lac,
			cellId.ci
		);

		const frameAnalysis = await analyzeFrameLog(
			stderrLog,
			frameCount,
			cellId.mcc,
			cellId.lac,
			cellId.ci
		);
		const channelResult = determineChannelType(cellId, frameAnalysis, frameCount);
		appendChannelEvents(
			events,
			label,
			cellId.mcc,
			cellId.mnc,
			cellId.lac,
			cellId.ci,
			frameCount,
			channelResult.channelType
		);

		const strength = classifySignalStrength(-100, frameCount);
		emitResultEvents(
			events,
			label,
			frameCount,
			strength,
			channelResult.channelType,
			channelResult.isControlChannel
		);
		const result = buildAndEmitResult(
			events,
			freq,
			frameCount,
			strength,
			channelResult.channelType,
			channelResult.isControlChannel,
			cellId,
			index,
			total
		);

		return { result, events };
	} catch (freqError) {
		return handleTestError(events, label, freq, freqError, index, total);
	} finally {
		await cleanupProcess(pid, freq, index, total, events);
		await removeStderrLog(stderrLog);
	}
}
