/**
 * GSM Evil page logic — API calls, scan orchestration, and tower location fetching.
 * Extracted from +page.svelte to comply with Article 2.2 (max 300 lines/file).
 */

import { tick } from 'svelte';

import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
import { gsmEvilStore, type TowerLocation } from '$lib/stores/gsm-evil-store';
import type { CapturedIMSI } from '$lib/types/gsm';
import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';
import { logger } from '$lib/utils/logger';

import type { GsmEvilPageState } from './gsm-evil-page-types';

// Re-export processScanStream from the dedicated scan-stream module
export { processScanStream } from './gsm-evil-scan-stream';

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
