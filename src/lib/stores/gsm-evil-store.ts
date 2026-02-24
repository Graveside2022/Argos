/**
 * GSM Evil Persistent State Store
 * Provides centralized state management with debounced localStorage persistence
 * for GSM Evil scan results and related data.
 */

import { get, type Readable, writable } from 'svelte/store';

import { browser } from '$app/environment';

import {
	debounceTimer,
	loadFromStorage,
	persistState,
	updateAndPersist,
	updateOnly
} from './gsm-evil-persistence';
import type {
	GSMEvilState,
	IMSICapture,
	ScanResult,
	StoreSet,
	StoreUpdate,
	TowerLocation
} from './gsm-evil-types';
import { defaultState, STORAGE_KEY, STORAGE_VERSION } from './gsm-evil-types';

// Re-export all types so existing consumers can continue to import from this module
export type { GSMEvilState, IMSICapture, ScanResult, StoreSet, StoreUpdate, TowerLocation };

function createScanResultActions(update: StoreUpdate) {
	return {
		setScanResults: (results: ScanResult[]) =>
			updateAndPersist(update, (state) => ({ ...state, scanResults: results })),

		addScanResult: (result: ScanResult) =>
			updateAndPersist(update, (state) => {
				const existingIndex = state.scanResults.findIndex(
					(r) => r.frequency === result.frequency
				);
				let newResults;

				if (existingIndex >= 0) {
					newResults = [...state.scanResults];
					newResults[existingIndex] = result;
				} else {
					newResults = [...state.scanResults, result];
				}

				return { ...state, scanResults: newResults };
			}),

		clearResults: () =>
			updateAndPersist(update, (state) => ({
				...defaultState,
				selectedFrequency: state.selectedFrequency,
				storageVersion: STORAGE_VERSION
			}))
	};
}

function createScanProgressActions(update: StoreUpdate) {
	return {
		addScanProgress: (message: string) =>
			updateOnly(update, (state) => ({
				...state,
				scanProgress: [...state.scanProgress, message].slice(-500)
			})),

		setScanProgress: (progress: string[]) =>
			updateOnly(update, (state) => ({ ...state, scanProgress: progress })),

		clearScanProgress: () => updateOnly(update, (state) => ({ ...state, scanProgress: [] })),

		setScanStatus: (status: string) =>
			updateAndPersist(update, (state) => ({ ...state, scanStatus: status }))
	};
}

function createScanStateActions(update: StoreUpdate) {
	return {
		setSelectedFrequency: (frequency: string) =>
			updateAndPersist(update, (state) => ({ ...state, selectedFrequency: frequency })),

		setIsScanning: (isScanning: boolean) =>
			updateAndPersist(update, (state) => ({ ...state, isScanning })),

		setShowScanProgress: (show: boolean) =>
			updateAndPersist(update, (state) => ({ ...state, showScanProgress: show }))
	};
}

function createScanLifecycleActions(update: StoreUpdate, store: Readable<GSMEvilState>) {
	return {
		startScan: () =>
			updateAndPersist(update, (state) => {
				const abortController = new AbortController();
				return {
					...state,
					isScanning: true,
					canStopScan: true,
					scanButtonText: 'Stop Scan',
					showScanProgress: true,
					scanAbortController: abortController,
					scanStatus: 'Starting scan...',
					scanProgress: ['[SCAN] Initializing GSM frequency scan...'],
					scanResults: []
				};
			}),
		stopScan: () =>
			updateAndPersist(update, (state) => {
				if (state.scanAbortController) {
					state.scanAbortController.abort();
				}
				return {
					...state,
					isScanning: false,
					canStopScan: false,
					scanButtonText: 'Start Scan',
					scanAbortController: null,
					scanStatus: 'Scan stopped by user',
					scanProgress: [...state.scanProgress, '[SCAN] Scan stopped by user']
				};
			}),
		completeScan: () =>
			updateAndPersist(update, (state) => ({
				...state,
				isScanning: false,
				canStopScan: false,
				scanButtonText: 'Start Scan',
				scanAbortController: null
			})),
		getAbortController: (): AbortController | null => {
			return get(store).scanAbortController;
		}
	};
}

function createCaptureActions(update: StoreUpdate) {
	return {
		setCapturedIMSIs: (imsis: IMSICapture[]) =>
			updateAndPersist(update, (state) => ({
				...state,
				capturedIMSIs: imsis,
				totalIMSIs: imsis.length
			})),

		addCapturedIMSI: (imsi: IMSICapture) =>
			updateAndPersist(update, (state) => {
				const cappedIMSIs = [...state.capturedIMSIs, imsi].slice(-1000);
				return {
					...state,
					capturedIMSIs: cappedIMSIs,
					totalIMSIs: state.totalIMSIs + 1
				};
			}),

		setTowerLocations: (locations: Record<string, TowerLocation>) =>
			updateAndPersist(update, (state) => ({ ...state, towerLocations: locations })),

		updateTowerLocation: (key: string, location: TowerLocation) =>
			updateAndPersist(update, (state) => ({
				...state,
				towerLocations: { ...state.towerLocations, [key]: location }
			})),

		setTowerLookupAttempted: (attempted: Record<string, boolean>) =>
			updateAndPersist(update, (state) => ({
				...state,
				towerLookupAttempted: attempted
			})),

		markTowerLookupAttempted: (key: string) =>
			updateAndPersist(update, (state) => ({
				...state,
				towerLookupAttempted: { ...state.towerLookupAttempted, [key]: true }
			}))
	};
}

function createUtilityActions(update: StoreUpdate, set: StoreSet) {
	return {
		batchUpdate: (updates: Partial<GSMEvilState>) =>
			updateAndPersist(update, (state) => ({ ...state, ...updates })),

		reset: () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			set(defaultState);
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		},

		forcePersist: () =>
			update((state) => {
				if (debounceTimer) clearTimeout(debounceTimer);
				persistState(state);
				return state;
			}),

		getSnapshot: () => {
			let currentState: GSMEvilState = defaultState;
			update((state) => {
				currentState = state;
				return state;
			});
			return currentState;
		}
	};
}

function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(defaultState);

	if (browser) {
		loadFromStorage(set);
	}

	const store = { subscribe };

	return {
		subscribe,
		...createScanResultActions(update),
		...createScanProgressActions(update),
		...createScanStateActions(update),
		...createScanLifecycleActions(update, store),
		...createCaptureActions(update),
		...createUtilityActions(update, set)
	};
}

export const gsmEvilStore = createGSMEvilStore();
