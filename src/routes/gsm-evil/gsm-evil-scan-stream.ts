/**
 * GSM Evil scan SSE stream processing.
 * Handles parsing, buffering, and dispatching of server-sent events
 * during intelligent frequency scanning.
 */

import { tick } from 'svelte';

import { gsmEvilStore, type ScanResult } from '$lib/stores/gsm-evil-store';
import type { FrequencyTestResult } from '$lib/types/gsm';

import { startIMSICapture } from './gsm-evil-page-logic';
import type { GsmEvilPageState } from './gsm-evil-page-types';

/** Scroll a DOM element to its bottom by CSS selector. */
function scrollToBottom(selector: string) {
	const el = document.querySelector(selector);
	if (el) el.scrollTop = el.scrollHeight;
}

/** Parse an SSE data line into a JSON object, or null on failure. */
function parseSSELine(line: string): Record<string, unknown> | null {
	if (!line.startsWith('data: ')) return null;
	try {
		return JSON.parse(line.slice(6));
	} catch {
		return null;
	}
}

/** Handle a parsed SSE message: show progress messages and dispatch results. */
async function handleSSEMessage(
	json: Record<string, unknown>,
	state: GsmEvilPageState,
	startPolling: () => void,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
) {
	if (json.message) {
		gsmEvilStore.addScanProgress(json.message as string);
		await tick();
		scrollToBottom('.scan-progress-body');
	}
	if (json.result) {
		await handleScanResult(
			json.result as Record<string, unknown>,
			state,
			startPolling,
			getCurrentStore
		);
	}
}

/** Process buffered SSE lines, dispatching each parsed message. */
async function processSSELines(
	lines: string[],
	state: GsmEvilPageState,
	startPolling: () => void,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
) {
	for (const line of lines) {
		const json = parseSSELine(line);
		if (json) await handleSSEMessage(json, state, startPolling, getCurrentStore);
	}
}

/** Whether the abort controller signal has fired. */
function isAborted(controller: AbortController | null): boolean {
	return !!controller?.signal.aborted;
}

/** Split buffered text into complete lines, returning remaining partial buffer. */
function splitBuffer(buffer: string, chunk: string): { lines: string[]; remaining: string } {
	const parts = (buffer + chunk).split('\n');
	return { lines: parts.slice(0, -1), remaining: parts[parts.length - 1] };
}

/** Get a reader from the response body, throwing if absent. */
function getStreamReader(response: Response): ReadableStreamDefaultReader<Uint8Array> {
	if (!response.body) throw new Error('No response body');
	return response.body.getReader();
}

/** Process SSE scan stream data */
export async function processScanStream(
	response: Response,
	abortController: AbortController | null,
	state: GsmEvilPageState,
	startPolling: () => void,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
): Promise<void> {
	const reader = getStreamReader(response);
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		if (isAborted(abortController)) {
			reader.cancel();
			return;
		}
		const { done, value } = await reader.read();
		if (done) break;
		const { lines, remaining } = splitBuffer(buffer, decoder.decode(value, { stream: true }));
		buffer = remaining;
		await processSSELines(lines, state, startPolling, getCurrentStore);
	}
}

/** Whether a new frequency result should replace the current best selection. */
function shouldUpdateBestFreq(
	result: FrequencyTestResult,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
): boolean {
	if (result.frameCount <= 0 || !getCurrentStore) return false;
	const store = getCurrentStore();
	const current = store.scanResults.find((r) => r.frequency === store.selectedFrequency);
	return !current || result.frameCount > (current.frameCount || 0);
}

/** Handle a frequency_result scan event. */
function handleFrequencyResult(
	data: Record<string, unknown>,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
) {
	const result = data.result as FrequencyTestResult;
	gsmEvilStore.addScanResult(result);
	const progress = data.progress as { completed: number; total: number };
	gsmEvilStore.setScanStatus(
		`Testing frequencies... ${progress.completed}/${progress.total} complete`
	);
	if (shouldUpdateBestFreq(result, getCurrentStore)) {
		gsmEvilStore.setSelectedFrequency(result.frequency);
	}
}

/** Handle individual scan result from SSE stream */
async function handleScanResult(
	data: Record<string, unknown>,
	state: GsmEvilPageState,
	startPolling: () => void,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
): Promise<void> {
	if (data.type === 'frequency_result') {
		handleFrequencyResult(data, getCurrentStore);
	} else if (data.type === 'scan_complete' || data.bestFrequency) {
		handleScanComplete(data, state, startPolling);
	}
}

/** Handle scan completion */
function handleScanComplete(
	data: Record<string, unknown>,
	state: GsmEvilPageState,
	startPolling: () => void
): void {
	if (data.bestFrequency) {
		const bestFreq = data.bestFrequency as string;
		const scanResults = (data.scanResults as ScanResult[]) || [];
		gsmEvilStore.setSelectedFrequency(bestFreq);
		gsmEvilStore.setScanResults(scanResults);
		gsmEvilStore.setScanStatus(
			`Found ${scanResults.length} active frequencies. Best: ${bestFreq} MHz`
		);
		gsmEvilStore.addScanProgress('[SCAN] Scan complete!');
		gsmEvilStore.addScanProgress(`[SCAN] Found ${scanResults.length} active frequencies`);

		const withCellData = scanResults.filter((r: ScanResult) => r.mcc && r.lac && r.ci).length;
		if (withCellData > 0) {
			gsmEvilStore.addScanProgress(
				`[SCAN] Cell identity captured for ${withCellData} frequency(ies) - tower data will display below`
			);
		} else {
			gsmEvilStore.addScanProgress(
				'[SCAN] No cell identity captured - tower table will not display'
			);
			gsmEvilStore.addScanProgress(
				'[SCAN] Cell identity requires BCCH channels with System Information messages'
			);
		}

		gsmEvilStore.addScanProgress(`[SCAN] Starting IMSI capture on ${bestFreq} MHz...`);
		startIMSICapture(bestFreq, state, startPolling);
	} else {
		gsmEvilStore.setScanStatus('No active frequencies found');
		gsmEvilStore.setScanResults([]);
		gsmEvilStore.addScanProgress('[SCAN] No active frequencies detected');
	}
}
