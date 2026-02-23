/**
 * GSM Intelligent Scan — main async generator
 *
 * Orchestrates the three phases of an intelligent GSM frequency scan:
 *   Phase 0: Prerequisite checks (grgsm, tcpdump, HackRF)
 *   Phase 1: HackRF resource acquisition with stale-lock recovery
 *   Phase 2: Multi-frequency scanning with BCCH channel detection
 *
 * Re-exports the shared ScanEvent / ScanEventType types so existing
 * consumers can keep importing from this module.
 */

import { errMsg } from '$lib/server/api/error-utils';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { logger } from '$lib/utils/logger';

import { testFrequency } from './gsm-scan-frequency-analysis';
import { acquireHackrf, checkPrerequisites } from './gsm-scan-prerequisites';
import { createResultEvent, createUpdateEvent } from './gsm-scan-types';

// NOTE: ScanEvent/ScanEventType re-exports removed — no external consumers

/**
 * Perform intelligent GSM frequency scan with live progress streaming.
 * Yields progress updates and results as they arrive.
 *
 * Features:
 * - Prerequisite checks (grgsm, tcpdump, HackRF availability)
 * - HackRF resource acquisition with stale lock recovery
 * - Multi-frequency scanning with BCCH channel detection
 * - Parallel tcpdump (frame count) + tshark (cell identity) capture
 * - Real-time progress updates for SSE streaming
 * - Automatic resource cleanup
 *
 * @yields ScanEvent objects containing progress updates and results
 */
/** Build Phase 2 header events describing the scan plan */
function buildPhase2Header(freqCount: number): import('./gsm-scan-types').ScanEvent[] {
	const estimatedTime = freqCount * 20;
	const estimatedMinutes = Math.ceil(estimatedTime / 60);
	return [
		createUpdateEvent(`[SCAN] Scanning ${freqCount} target frequencies`),
		createUpdateEvent('[SCAN] '),
		createUpdateEvent('[SCAN] Phase 2: GSM Frame Detection & BCCH Channel Discovery'),
		createUpdateEvent(`[SCAN] Testing ${freqCount} frequencies for 15 seconds each...`),
		createUpdateEvent(
			`[SCAN] Estimated time: ~${estimatedMinutes} minutes (${estimatedTime} seconds)`
		),
		createUpdateEvent(
			'[SCAN] This comprehensive scan will identify BCCH channels with complete cell tower data'
		),
		createUpdateEvent('[SCAN] ')
	];
}

/** Safely release HackRF resource (best-effort) */
async function releaseHackrf(): Promise<void> {
	try {
		await resourceManager.release('gsm-scan', HardwareDevice.HACKRF);
	} catch (releaseError) {
		logger.error('[gsm-scan] Failed to release HackRF', {
			error: releaseError instanceof Error ? releaseError.message : String(releaseError)
		});
	}
}

/** Yield all events from an array */
async function* yieldEvents(
	events: import('./gsm-scan-types').ScanEvent[]
): AsyncGenerator<import('./gsm-scan-types').ScanEvent> {
	for (const ev of events) yield ev;
}

/** Build error events for a scan failure */
function buildScanErrorEvents(error: unknown): import('./gsm-scan-types').ScanEvent[] {
	const msg = errMsg(error);
	return [
		createUpdateEvent(`[ERROR] Scan failed: ${msg}`),
		createResultEvent({ success: false, message: 'Scan failed', error: msg })
	];
}

/** Scan all frequencies sequentially, collecting results */
async function scanFrequencies(
	freqs: string[]
): Promise<{ results: FrequencyTestResult[]; events: import('./gsm-scan-types').ScanEvent[] }> {
	const results: FrequencyTestResult[] = [];
	const events: import('./gsm-scan-types').ScanEvent[] = [];
	for (let i = 0; i < freqs.length; i++) {
		const outcome = await testFrequency(freqs[i], i, freqs.length);
		events.push(...outcome.events);
		results.push(outcome.result);
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	return { results, events };
}

export async function* performIntelligentScan(): AsyncGenerator<
	import('./gsm-scan-types').ScanEvent
> {
	let hackrfAcquired = false;

	try {
		const prereqs = await checkPrerequisites();
		yield* yieldEvents(prereqs.events);
		if (!prereqs.success) return;

		const hackrf = await acquireHackrf();
		yield* yieldEvents(hackrf.events);
		if (!hackrf.success) return;
		hackrfAcquired = true;

		const checkFreqs: string[] = ['947.2', '950.0'];
		yield* yieldEvents(buildPhase2Header(checkFreqs.length));

		const scan = await scanFrequencies(checkFreqs);
		yield* yieldEvents(scan.events);
		yield* emitSummary(scan.results);
	} catch (error: unknown) {
		yield* yieldEvents(buildScanErrorEvents(error));
	} finally {
		if (hackrfAcquired) await releaseHackrf();
	}
}

/** Default frequency result when no results exist */
const DEFAULT_FREQ_RESULT: FrequencyTestResult = {
	frequency: '947.2',
	frameCount: 0,
	power: -100,
	strength: 'No Signal',
	hasGsmActivity: false,
	channelType: '',
	controlChannel: false
};

/** Select the best frequency result — first active, or first overall, or default */
function selectBestFrequency(sorted: FrequencyTestResult[]): FrequencyTestResult {
	return sorted.find((r) => r.hasGsmActivity) || sorted[0] || DEFAULT_FREQ_RESULT;
}

/** Format a single active frequency line */
function formatActiveFreq(result: FrequencyTestResult, index: number): string {
	const cellInfo = result.mcc
		? ` [MCC=${result.mcc} MNC=${result.mnc} LAC=${result.lac} CI=${result.ci}]`
		: '';
	return `[SCAN] ${index + 1}. ${result.frequency} MHz: ${result.frameCount} frames (${result.strength}) ${result.channelType || ''}${cellInfo}`;
}

/** Build the best-frequency detail lines */
function buildBestFreqLines(best: FrequencyTestResult): string[] {
	const signalDisplay =
		best.power > -100 ? `${best.power.toFixed(1)} dBm` : `${best.frameCount} frames`;
	const lines = [
		`[SCAN] BEST FREQUENCY: ${best.frequency} MHz`,
		`[SCAN] GSM frames detected: ${best.frameCount}`,
		`[SCAN] Signal: ${signalDisplay} (${best.strength})`
	];
	if (best.channelType) {
		lines.push(
			`[SCAN] Channel type: ${best.channelType}${best.controlChannel ? ' (Control Channel)' : ''}`
		);
	}
	return lines;
}

/** Build the complete summary event list */
function buildSummaryEvents(
	results: FrequencyTestResult[]
): import('./gsm-scan-types').ScanEvent[] {
	results.sort((a, b) => b.frameCount - a.frameCount);
	const bestFreq = selectBestFrequency(results);
	const activeResults = results.filter((r) => r.frameCount > 0);

	const events: import('./gsm-scan-types').ScanEvent[] = [
		createUpdateEvent('[SCAN] '),
		createUpdateEvent('[SCAN] ========== SCAN COMPLETE =========='),
		createUpdateEvent(`[SCAN] Tested ${results.length} frequencies`),
		createUpdateEvent('[SCAN] '),
		createUpdateEvent(
			`[SCAN] ACTIVE FREQUENCIES (${activeResults.length} of ${results.length} tested):`
		),
		...activeResults.map((r, i) => createUpdateEvent(formatActiveFreq(r, i)))
	];

	if (activeResults.length === 0) {
		events.push(createUpdateEvent('[SCAN] No active GSM frequencies found'));
	}

	events.push(createUpdateEvent('[SCAN] '));
	for (const line of buildBestFreqLines(bestFreq)) {
		events.push(createUpdateEvent(line));
	}
	events.push(createUpdateEvent('[SCAN] =================================='));
	events.push(
		createResultEvent({
			type: 'scan_complete',
			success: true,
			bestFrequency: bestFreq.frequency,
			bestFrequencyFrames: bestFreq.frameCount,
			scanResults: results,
			totalTested: results.length
		})
	);

	return events;
}

async function* emitSummary(
	results: FrequencyTestResult[]
): AsyncGenerator<import('./gsm-scan-types').ScanEvent> {
	yield* yieldEvents(buildSummaryEvents(results));
}
