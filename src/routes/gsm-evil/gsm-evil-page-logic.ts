/**
 * GSM Evil page logic — API calls, scan orchestration, and tower location fetching.
 * Extracted from +page.svelte to comply with Article 2.2 (max 300 lines/file).
 */

import { tick } from 'svelte';

import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
import { gsmEvilStore, type ScanResult, type TowerLocation } from '$lib/stores/gsm-evil-store';
import type { CapturedIMSI, FrequencyTestResult } from '$lib/types/gsm';
import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';
import { logger } from '$lib/utils/logger';

import type { GsmEvilPageState } from './gsm-evil-page-types';

/** Scroll a DOM element to its bottom by CSS selector. */
function scrollToBottom(selector: string) {
	const el = document.querySelector(selector);
	if (el) el.scrollTop = el.scrollHeight;
}

/** Fetch tower location from the API */
export async function fetchTowerLocation(
	mcc: string,
	mnc: string,
	lac: string,
	ci: string
): Promise<{ found: boolean; location: TowerLocation } | null> {
	try {
		const response = await fetch('/api/gsm-evil/tower-location', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mcc, mnc, lac, ci })
		});
		if (response.ok) {
			return await response.json();
		}
	} catch (error) {
		logger.error('Failed to fetch tower location', { error });
	}
	return null;
}

/** Fetch tower locations for captured IMSIs */
export function fetchTowerLocationsForIMSIs(
	capturedIMSIs: CapturedIMSI[],
	towerLocations: Record<string, TowerLocation>,
	towerLookupAttempted: Record<string, boolean>
): void {
	if (capturedIMSIs.length === 0) return;
	const towers = groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations);
	towers.forEach(async (tower) => {
		const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`;
		if (!towerLocations[towerId] && !towerLookupAttempted[towerId]) {
			gsmEvilStore.markTowerLookupAttempted(towerId);
			const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
			if (result && result.found) {
				gsmEvilStore.updateTowerLocation(towerId, result.location);
			}
		}
	});
}

/** Fetch tower locations for scan-detected towers */
export function fetchTowerLocationsForScanResults(
	scanDetectedTowers: Array<{
		towerId: string;
		mcc: string;
		mnc: string;
		lac: string;
		ci: string;
	}>,
	towerLocations: Record<string, TowerLocation>,
	towerLookupAttempted: Record<string, boolean>
): void {
	if (scanDetectedTowers.length === 0) return;
	scanDetectedTowers.forEach(async (tower) => {
		if (!towerLocations[tower.towerId] && !towerLookupAttempted[tower.towerId]) {
			gsmEvilStore.markTowerLookupAttempted(tower.towerId);
			const result = await fetchTowerLocation(tower.mcc, tower.mnc, tower.lac, tower.ci);
			if (result && result.found) {
				gsmEvilStore.updateTowerLocation(tower.towerId, result.location);
			}
		}
	});
}

/** Whether a frames response contains new frame data. */
function hasFrameData(data: Record<string, unknown>): boolean {
	const frames = data.frames as unknown[] | undefined;
	return !!(data.success && frames && frames.length > 0);
}

const MAX_FRAMES = 30;

/** Append new frames to state and trim to max, then scroll the console into view. */
async function appendFrames(state: GsmEvilPageState, frames: string[]) {
	state.gsmFrames = [...state.gsmFrames, ...frames];
	if (state.gsmFrames.length > MAX_FRAMES) {
		state.gsmFrames = state.gsmFrames.slice(-MAX_FRAMES);
	}
	await tick();
	scrollToBottom('.live-frames-console');
}

/** Log a non-OK frames response. */
function logFrameError(response: Response) {
	if (response.status === 401) {
		logger.error('[GSM Frames] Authentication failed - session may have expired');
	} else {
		logger.error('[GSM Frames] API error', {
			status: response.status,
			statusText: response.statusText
		});
	}
}

/** Fetch real GSM frames from the API */
export async function fetchRealFrames(state: GsmEvilPageState): Promise<void> {
	try {
		const response = await fetch('/api/gsm-evil/live-frames', { credentials: 'same-origin' });
		if (!response.ok) {
			logFrameError(response);
			return;
		}
		const data = await response.json();
		if (hasFrameData(data)) await appendFrames(state, data.frames);
	} catch (error) {
		logger.error('[GSM Frames] Failed to fetch', { error });
	}
}

/** Check GSM Evil activity status */
export async function checkActivity(state: GsmEvilPageState): Promise<void> {
	try {
		const response = await fetch('/api/gsm-evil/activity');
		if (response.ok) {
			const data = await response.json();
			state.activityStatus = {
				hasActivity: data.hasActivity,
				packetCount: data.packetCount,
				recentIMSI: data.recentIMSI,
				currentFrequency: data.currentFrequency,
				message: data.message
			};
		}
	} catch (error) {
		logger.error('Failed to check activity', { error });
	}
}

/** Fetch captured IMSIs */
export async function fetchIMSIs(): Promise<void> {
	try {
		const response = await fetch('/api/gsm-evil/imsi');
		if (response.ok) {
			const data = await response.json();
			if (data.success) {
				gsmEvilStore.setCapturedIMSIs(data.imsis);
			}
		}
	} catch (error) {
		logger.error('Failed to fetch IMSIs', { error });
	}
}

/** Start IMSI capture on a given frequency */
export async function startIMSICapture(
	frequency: string,
	state: GsmEvilPageState,
	startPolling: () => void
): Promise<void> {
	if (state.imsiCaptureActive) return;
	try {
		const response = await fetch('/api/gsm-evil/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start', frequency })
		});
		const data = (await response.json()) as { success: boolean; message: string };
		if (response.ok && data.success) {
			state.imsiCaptureActive = true;
			startPolling();
			fetchIMSIs();
			checkActivity(state);
			fetchRealFrames(state);
		} else {
			logger.error('[GSM] Failed to start IMSI capture', { message: data.message });
		}
	} catch (error) {
		logger.error('[GSM] Error starting IMSI capture', { error });
	}
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
