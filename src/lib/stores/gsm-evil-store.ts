/**
 * GSM Evil Persistent State Store
 * Provides centralized state management with debounced localStorage persistence
 * for GSM Evil scan results and related data.
 */

import { get, type Readable, type Updater, writable } from 'svelte/store';

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';

const STORAGE_KEY = 'gsm-evil-state';
const STORAGE_VERSION = '1.0';
const DEBOUNCE_MS = 2000;

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
	frequency?: string;
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
	scanResults: ScanResult[];
	scanProgress: string[];
	scanStatus: string;
	selectedFrequency: string;
	isScanning: boolean;
	showScanProgress: boolean;
	scanAbortController: AbortController | null;
	canStopScan: boolean;
	scanButtonText: string;
	capturedIMSIs: IMSICapture[];
	totalIMSIs: number;
	towerLocations: Record<string, TowerLocation>;
	towerLookupAttempted: Record<string, boolean>;
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

/** Fields excluded from localStorage — transient runtime state */
const TRANSIENT_KEYS: (keyof GSMEvilState)[] = ['scanProgress', 'scanAbortController'];

type StoreUpdate = (updater: Updater<GSMEvilState>) => void;
type StoreSet = (value: GSMEvilState) => void;

function loadFromStorage(set: StoreSet): void {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsedState = JSON.parse(saved) as Partial<GSMEvilState>;

			if (parsedState.storageVersion !== STORAGE_VERSION) {
				logger.warn('GSM Evil state version mismatch, resetting to default');
				localStorage.removeItem(STORAGE_KEY);
				return;
			}

			// CRITICAL: scanAbortController cannot survive JSON serialization
			const mergedState = { ...defaultState, ...parsedState, scanAbortController: null };
			set(mergedState);
		}
	} catch (error) {
		logger.error('Failed to load GSM Evil state from localStorage', { error });
		localStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Persist structural state to localStorage, excluding transient fields.
 * Called by the debounce timer — not directly by store actions.
 */
/** Build a saveable state object with transient keys removed. */
function buildSaveableState(state: GSMEvilState): string {
	const stateToSave: Record<string, unknown> = {
		...state,
		lastScanTime: new Date().toISOString(),
		storageVersion: STORAGE_VERSION
	};
	for (const key of TRANSIENT_KEYS) delete stateToSave[key];
	return JSON.stringify(stateToSave);
}

/** Handle localStorage write errors. */
function handlePersistError(error: unknown): void {
	if (error instanceof DOMException && error.name === 'QuotaExceededError') {
		logger.warn('localStorage quota exceeded, clearing old data');
		localStorage.removeItem(STORAGE_KEY);
	} else {
		logger.error('Failed to persist GSM Evil state to localStorage', { error });
	}
}

function persistState(state: GSMEvilState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, buildSaveableState(state));
	} catch (error) {
		handlePersistError(error);
	}
}

/** Debounce timer for persistence — 2s trailing edge */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(state: GSMEvilState): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		persistState(state);
	}, DEBOUNCE_MS);
}

/** Update store and schedule debounced persistence */
function updateAndPersist(
	update: StoreUpdate,
	updater: (state: GSMEvilState) => GSMEvilState
): void {
	update((state) => {
		const newState = updater(state);
		schedulePersist(newState);
		return newState;
	});
}

/** Update store without triggering persistence (for transient state) */
function updateOnly(update: StoreUpdate, updater: (state: GSMEvilState) => GSMEvilState): void {
	update((state) => updater(state));
}

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
