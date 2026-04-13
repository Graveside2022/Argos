/**
 * GSM Evil page logic — API calls, scan orchestration, and tower location fetching.
 * Extracted from +page.svelte to comply with Article 2.2 (max 300 lines/file).
 */

import { tick } from 'svelte';

import { mccToCountry, mncToCarrier } from '$lib/data/carrier-mappings';
import { gsmEvilStore, type TowerLocation } from '$lib/stores/gsm-evil-store';
import type { CapturedIMSI } from '$lib/types/gsm';
import { fetchJSON } from '$lib/utils/fetch-json';
import { groupIMSIsByTower } from '$lib/utils/gsm-tower-utils';
import { logger } from '$lib/utils/logger';

import type { GsmEvilPageState } from './gsm-evil-page-types';

/** Track in-flight tower lookups to prevent duplicate requests across effect re-runs */
const pendingLookups = new Set<string>();
/** Max concurrent tower-location API requests */
const MAX_CONCURRENT_LOOKUPS = 3;

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
	return fetchJSON<{ found: boolean; location: TowerLocation }>('/api/gsm-evil/tower-location', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mcc, mnc, lac, ci })
	});
}

/** Look up a single tower, guarded by the in-flight set */
async function lookupTower(
	towerId: string,
	mcc: string,
	mnc: string,
	lac: string,
	ci: string
): Promise<void> {
	if (pendingLookups.has(towerId)) return;
	pendingLookups.add(towerId);
	try {
		gsmEvilStore.markTowerLookupAttempted(towerId);
		const result = await fetchTowerLocation(mcc, mnc, lac, ci);
		if (result && result.found) {
			gsmEvilStore.updateTowerLocation(towerId, result.location);
		}
	} finally {
		pendingLookups.delete(towerId);
	}
}

type TowerRef = { towerId: string; mcc: string; mnc: string; lac: string; ci: string };

/** True if a tower needs a fresh lookup (not cached, not attempted, not in-flight). */
function needsTowerLookup(
	towerId: string,
	towerLocations: Record<string, unknown>,
	towerLookupAttempted: Record<string, unknown>
): boolean {
	return (
		!towerLocations[towerId] && !towerLookupAttempted[towerId] && !pendingLookups.has(towerId)
	);
}

/** Run tower lookups in batches of MAX_CONCURRENT_LOOKUPS, sequentially per batch. */
async function runTowerLookupsInBatches(pending: TowerRef[]): Promise<void> {
	for (let i = 0; i < pending.length; i += MAX_CONCURRENT_LOOKUPS) {
		const batch = pending.slice(i, i + MAX_CONCURRENT_LOOKUPS);
		await Promise.all(batch.map((t) => lookupTower(t.towerId, t.mcc, t.mnc, t.lac, t.ci)));
	}
}

/** Fetch tower locations for captured IMSIs (batched, max 3 concurrent) */
export async function fetchTowerLocationsForIMSIs(capturedIMSIs: CapturedIMSI[]): Promise<void> {
	if (capturedIMSIs.length === 0) return;
	const { towerLocations, towerLookupAttempted } = gsmEvilStore.getSnapshot();
	const towers = groupIMSIsByTower(capturedIMSIs, mncToCarrier, mccToCountry, towerLocations);
	const pending: TowerRef[] = towers
		.map((tower) => ({
			towerId: `${tower.mccMnc}-${tower.lac}-${tower.ci}`,
			mcc: tower.mcc,
			mnc: tower.mnc,
			lac: tower.lac,
			ci: tower.ci
		}))
		.filter((t) => needsTowerLookup(t.towerId, towerLocations, towerLookupAttempted));
	await runTowerLookupsInBatches(pending);
}

/** Fetch tower locations for scan-detected towers (batched, max 3 concurrent) */
export async function fetchTowerLocationsForScanResults(
	scanDetectedTowers: TowerRef[]
): Promise<void> {
	if (scanDetectedTowers.length === 0) return;
	const { towerLocations, towerLookupAttempted } = gsmEvilStore.getSnapshot();
	const pending = scanDetectedTowers.filter((t) =>
		needsTowerLookup(t.towerId, towerLocations, towerLookupAttempted)
	);
	await runTowerLookupsInBatches(pending);
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
	const data = await fetchJSON<{ success: boolean; imsis: CapturedIMSI[] }>('/api/gsm-evil/imsi');
	if (data?.success) gsmEvilStore.setCapturedIMSIs(data.imsis);
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
