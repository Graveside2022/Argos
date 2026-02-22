/**
 * GSM Evil Persistent State Store
 * Provides centralized state management with localStorage persistence
 * for GSM Evil scan results and related data.
 */

import { type Updater, writable } from 'svelte/store';

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';

const STORAGE_KEY = 'gsm-evil-state';
const STORAGE_VERSION = '1.0';

export interface IMSICapture {
	imsi: string;
	tmsi?: string;
	mcc: string | number;
	mnc: string | number;
	lac: number;
	ci: number;
	lat?: number;
	lon?: number;
	timestamp: string;
	frequency?: string; // Extra field for store tracking
}

export interface TowerLocation {
	lat: number;
	lon: number;
	range?: number;
	samples?: number;
	city?: string;
	source?: string;
	lastUpdated?: string;
}

export interface ScanResult {
	frequency: string;
	power: number;
	strength: string;
	frameCount?: number;
	hasGsmActivity?: boolean;
	channelType?: string;
	controlChannel?: boolean;
	mcc?: string;
	mnc?: string;
	lac?: string;
	ci?: string;
}

export interface GSMEvilState {
	// Core scan data
	scanResults: ScanResult[];
	scanProgress: string[];
	scanStatus: string;
	selectedFrequency: string;
	isScanning: boolean;
	showScanProgress: boolean;

	// Scan control
	scanAbortController: AbortController | null;
	canStopScan: boolean;
	scanButtonText: string;

	// IMSI and tower data
	capturedIMSIs: IMSICapture[];
	totalIMSIs: number;
	towerLocations: Record<string, TowerLocation>;
	towerLookupAttempted: Record<string, boolean>;

	// Metadata
	lastScanTime: string | null;
	storageVersion: string;
}

const defaultState: GSMEvilState = {
	scanResults: [],
	scanProgress: [],
	scanStatus: '',
	selectedFrequency: '947.2',
	isScanning: false,
	showScanProgress: false,
	scanAbortController: null,
	canStopScan: false,
	scanButtonText: 'Start Scan',
	capturedIMSIs: [],
	totalIMSIs: 0,
	towerLocations: {},
	towerLookupAttempted: {},
	lastScanTime: null,
	storageVersion: STORAGE_VERSION
};

/** Svelte store update function type for GSMEvilState */
type StoreUpdate = (updater: Updater<GSMEvilState>) => void;

/** Svelte store set function type for GSMEvilState */
type StoreSet = (value: GSMEvilState) => void;

/**
 * Load persisted GSM Evil state from localStorage, merging with defaults.
 * Handles version migration by clearing stale data.
 */
function loadFromStorage(set: StoreSet): void {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsedState = JSON.parse(saved) as Partial<GSMEvilState>;

			// Version migration logic
			if (parsedState.storageVersion !== STORAGE_VERSION) {
				logger.warn('GSM Evil state version mismatch, resetting to default');
				localStorage.removeItem(STORAGE_KEY);
				return;
			}

			// Merge with defaults to handle missing properties
			// CRITICAL: scanAbortController cannot survive JSON serialization (becomes {} not null)
			// Always reset it to null on load to prevent .abort() crashes
			const mergedState = { ...defaultState, ...parsedState, scanAbortController: null };
			set(mergedState);
		}
	} catch (error) {
		logger.error('Failed to load GSM Evil state from localStorage', { error });
		localStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Persist GSM Evil state to localStorage with timestamp and version.
 * Handles quota exceeded errors by clearing stale data.
 */
function persistState(state: GSMEvilState): void {
	if (!browser) return;

	try {
		const stateToSave = {
			...state,
			lastScanTime: new Date().toISOString(),
			storageVersion: STORAGE_VERSION
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
	} catch (error) {
		logger.error('Failed to persist GSM Evil state to localStorage', { error });

		// Handle quota exceeded
		if (error instanceof DOMException && error.name === 'QuotaExceededError') {
			logger.warn('localStorage quota exceeded, clearing old data');
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

/** Helper: update state and persist in one step */
function updateAndPersist(
	update: StoreUpdate,
	updater: (state: GSMEvilState) => GSMEvilState
): void {
	update((state) => {
		const newState = updater(state);
		persistState(newState);
		return newState;
	});
}

/** Create scan result management actions (add, set, update, clear results) */
function createScanResultActions(update: StoreUpdate) {
	return {
		updateScanResults: (results: ScanResult[]) =>
			updateAndPersist(update, (state) => ({ ...state, scanResults: results })),

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

/** Create scan progress and status management actions */
function createScanProgressActions(update: StoreUpdate) {
	return {
		addScanProgress: (message: string) =>
			updateAndPersist(update, (state) => ({
				...state,
				scanProgress: [...state.scanProgress, message].slice(-500)
			})),

		setScanProgress: (progress: string[]) =>
			updateAndPersist(update, (state) => ({ ...state, scanProgress: progress })),

		clearScanProgress: () =>
			updateAndPersist(update, (state) => ({ ...state, scanProgress: [] })),

		setScanStatus: (status: string) =>
			updateAndPersist(update, (state) => ({ ...state, scanStatus: status }))
	};
}

/** Create scan field setter actions (frequency, scanning flag, progress visibility) */
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

/** Create scan lifecycle actions (start, stop, complete, abort controller access) */
function createScanLifecycleActions(update: StoreUpdate) {
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
			let controller: AbortController | null = null;
			update((state) => {
				controller = state.scanAbortController;
				return state;
			});
			return controller;
		}
	};
}

/** Create IMSI capture and tower location management actions */
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

/** Create store utility actions (batch update, reset, persist, snapshot) */
function createUtilityActions(update: StoreUpdate, set: StoreSet) {
	return {
		batchUpdate: (updates: Partial<GSMEvilState>) =>
			updateAndPersist(update, (state) => ({ ...state, ...updates })),

		reset: () => {
			set(defaultState);
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		},

		forcePersist: () =>
			update((state) => {
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

/**
 * Create the GSM Evil persistent state store.
 * Provides centralized state management with localStorage persistence
 * for GSM Evil scan results, IMSI captures, and tower data.
 */
function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(defaultState);

	if (browser) {
		loadFromStorage(set);
	}

	return {
		subscribe,
		...createScanResultActions(update),
		...createScanProgressActions(update),
		...createScanStateActions(update),
		...createScanLifecycleActions(update),
		...createCaptureActions(update),
		...createUtilityActions(update, set)
	};
}

export const gsmEvilStore = createGSMEvilStore();
