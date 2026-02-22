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

import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type { FrequencyTestResult } from '$lib/types/gsm';
import { logger } from '$lib/utils/logger';

import { testFrequency } from './gsm-scan-frequency-analysis';
import { acquireHackrf, checkPrerequisites } from './gsm-scan-prerequisites';
import { createResultEvent, createUpdateEvent } from './gsm-scan-types';

// Re-export types so existing import paths remain valid
export type { ScanEvent, ScanEventType } from './gsm-scan-types';

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
export async function* performIntelligentScan(): AsyncGenerator<
	import('./gsm-scan-types').ScanEvent
> {
	let hackrfAcquired = false;

	try {
		// ============================================
		// PHASE 0: Prerequisite Checks
		// ============================================
		const prereqs = await checkPrerequisites();
		for (const ev of prereqs.events) yield ev;
		if (!prereqs.success) return;

		// ============================================
		// PHASE 1: Acquire HackRF Resource
		// ============================================
		const hackrf = await acquireHackrf();
		for (const ev of hackrf.events) yield ev;
		if (!hackrf.success) return;
		hackrfAcquired = true;

		// ============================================
		// PHASE 2: Scan GSM-900 downlink frequencies
		// ============================================
		const checkFreqs: string[] = ['947.2', '950.0'];
		yield createUpdateEvent(`[SCAN] Scanning ${checkFreqs.length} target frequencies`);

		yield createUpdateEvent('[SCAN] ');
		yield createUpdateEvent('[SCAN] Phase 2: GSM Frame Detection & BCCH Channel Discovery');
		yield createUpdateEvent(
			`[SCAN] Testing ${checkFreqs.length} frequencies for 15 seconds each...`
		);
		const estimatedTime = checkFreqs.length * 20;
		const estimatedMinutes = Math.ceil(estimatedTime / 60);
		yield createUpdateEvent(
			`[SCAN] Estimated time: ~${estimatedMinutes} minutes (${estimatedTime} seconds)`
		);
		yield createUpdateEvent(
			'[SCAN] This comprehensive scan will identify BCCH channels with complete cell tower data'
		);
		yield createUpdateEvent('[SCAN] ');

		const results: FrequencyTestResult[] = [];

		for (let i = 0; i < checkFreqs.length; i++) {
			const outcome = await testFrequency(checkFreqs[i], i, checkFreqs.length);
			for (const ev of outcome.events) yield ev;
			results.push(outcome.result);

			// Brief pause between frequencies
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// ============================================
		// PHASE 3: Summarise results
		// ============================================
		yield* emitSummary(results);
	} catch (error: unknown) {
		yield createUpdateEvent(`[ERROR] Scan failed: ${(error as Error).message}`);
		yield createResultEvent({
			success: false,
			message: 'Scan failed',
			error: (error as Error).message
		});
	} finally {
		if (hackrfAcquired) {
			try {
				await resourceManager.release('gsm-scan', HardwareDevice.HACKRF);
			} catch (releaseError) {
				logger.error('[gsm-scan] Failed to release HackRF', {
					error:
						releaseError instanceof Error ? releaseError.message : String(releaseError)
				});
			}
		}
	}
}

/**
 * Yield the scan-complete summary events.
 *
 * @param results - Collected frequency test results, sorted in place
 * @yields ScanEvent update and result events
 */
async function* emitSummary(
	results: FrequencyTestResult[]
): AsyncGenerator<import('./gsm-scan-types').ScanEvent> {
	results.sort((a, b) => b.frameCount - a.frameCount);

	const bestFreq = results.find((r) => r.hasGsmActivity) ||
		results[0] || {
			frequency: '947.2',
			frameCount: 0,
			power: -100,
			strength: 'No Signal',
			hasGsmActivity: false,
			channelType: '',
			controlChannel: false
		};

	yield createUpdateEvent('[SCAN] ');
	yield createUpdateEvent('[SCAN] ========== SCAN COMPLETE ==========');
	yield createUpdateEvent(`[SCAN] Tested ${results.length} frequencies`);

	const activeResults = results.filter((r) => r.frameCount > 0);
	yield createUpdateEvent('[SCAN] ');
	yield createUpdateEvent(
		`[SCAN] ACTIVE FREQUENCIES (${activeResults.length} of ${results.length} tested):`
	);

	for (let index = 0; index < activeResults.length; index++) {
		const result = activeResults[index];
		const cellInfo = result.mcc
			? ` [MCC=${result.mcc} MNC=${result.mnc} LAC=${result.lac} CI=${result.ci}]`
			: '';
		yield createUpdateEvent(
			`[SCAN] ${index + 1}. ${result.frequency} MHz: ${result.frameCount} frames (${result.strength}) ${result.channelType || ''}${cellInfo}`
		);
	}

	if (activeResults.length === 0) {
		yield createUpdateEvent('[SCAN] No active GSM frequencies found');
	}

	yield createUpdateEvent('[SCAN] ');
	yield createUpdateEvent(`[SCAN] BEST FREQUENCY: ${bestFreq.frequency} MHz`);
	yield createUpdateEvent(`[SCAN] GSM frames detected: ${bestFreq.frameCount}`);

	const signalDisplay =
		bestFreq.power > -100
			? `${bestFreq.power.toFixed(1)} dBm`
			: `${bestFreq.frameCount} frames`;
	yield createUpdateEvent(`[SCAN] Signal: ${signalDisplay} (${bestFreq.strength})`);

	if (bestFreq.channelType) {
		yield createUpdateEvent(
			`[SCAN] Channel type: ${bestFreq.channelType}${bestFreq.controlChannel ? ' (Control Channel)' : ''}`
		);
	}
	yield createUpdateEvent('[SCAN] ==================================');

	yield createResultEvent({
		type: 'scan_complete',
		success: true,
		bestFrequency: bestFreq.frequency,
		bestFrequencyFrames: bestFreq.frameCount,
		scanResults: results,
		totalTested: results.length
	});
}
