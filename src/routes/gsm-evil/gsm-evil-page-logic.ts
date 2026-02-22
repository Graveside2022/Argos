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

/** Fetch real GSM frames from the API */
export async function fetchRealFrames(state: GsmEvilPageState): Promise<void> {
	try {
		const response = await fetch('/api/gsm-evil/live-frames', {
			credentials: 'same-origin'
		});
		if (response.ok) {
			const data = await response.json();
			if (data.success && data.frames && data.frames.length > 0) {
				state.gsmFrames = [...state.gsmFrames, ...data.frames];
				if (state.gsmFrames.length > 30) {
					state.gsmFrames = state.gsmFrames.slice(-30);
				}
				await tick();
				const frameDisplay = document.querySelector('.live-frames-console');
				if (frameDisplay) {
					frameDisplay.scrollTop = frameDisplay.scrollHeight;
				}
			}
		} else if (response.status === 401) {
			logger.error('[GSM Frames] Authentication failed - session may have expired');
		} else {
			logger.error('[GSM Frames] API error', {
				status: response.status,
				statusText: response.statusText
			});
		}
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

/** Process SSE scan stream data */
export async function processScanStream(
	response: Response,
	abortController: AbortController | null,
	state: GsmEvilPageState,
	startPolling: () => void,
	getCurrentStore?: () => { scanResults: ScanResult[]; selectedFrequency: string }
): Promise<void> {
	if (!response.body) {
		throw new Error('No response body');
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		if (abortController?.signal.aborted) {
			reader.cancel();
			return;
		}
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (line.startsWith('data: ')) {
				try {
					const json = JSON.parse(line.slice(6));
					if (json.message) {
						gsmEvilStore.addScanProgress(json.message);
						await tick();
						const progressEl = document.querySelector('.scan-progress-body');
						if (progressEl) {
							progressEl.scrollTop = progressEl.scrollHeight;
						}
					}
					if (json.result) {
						await handleScanResult(json.result, state, startPolling, getCurrentStore);
					}
				} catch (e) {
					logger.error('Error parsing SSE data', { error: e });
				}
			}
		}
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
		const result = data.result as FrequencyTestResult;
		gsmEvilStore.addScanResult(result);

		const progress = data.progress as { completed: number; total: number };
		gsmEvilStore.setScanStatus(
			`Testing frequencies... ${progress.completed}/${progress.total} complete`
		);

		if (result.frameCount > 0 && getCurrentStore) {
			const storeVal = getCurrentStore();
			const currentSelected = storeVal.scanResults.find(
				(r: ScanResult) => r.frequency === storeVal.selectedFrequency
			);
			if (!currentSelected || result.frameCount > (currentSelected.frameCount || 0)) {
				gsmEvilStore.setSelectedFrequency(result.frequency);
			}
		}
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
