/**
 * GSM Evil Persistent State Store
 * Provides centralized state management with localStorage persistence
 * for GSM Evil scan results and related data.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'gsm-evil-state';
const STORAGE_VERSION = '1.0';

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
	capturedIMSIs: any[];
	totalIMSIs: number;
	towerLocations: { [key: string]: any };
	towerLookupAttempted: { [key: string]: boolean };

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

function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(defaultState);

	// Initialize store from localStorage
	if (browser) {
		loadFromStorage();
	}

	function loadFromStorage() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsedState = JSON.parse(saved);

				// Version migration logic
				if (parsedState.storageVersion !== STORAGE_VERSION) {
					console.warn('GSM Evil state version mismatch, resetting to default');
					localStorage.removeItem(STORAGE_KEY);
					return;
				}

				// Merge with defaults to handle missing properties
				const mergedState = { ...defaultState, ...parsedState };
				set(mergedState);
			}
		} catch (error) {
			console.error('Failed to load GSM Evil state from localStorage:', error);
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	function persistState(state: GSMEvilState) {
		if (!browser) return;

		try {
			// Create a clean state object for persistence
			const stateToSave = {
				...state,
				lastScanTime: new Date().toISOString(),
				storageVersion: STORAGE_VERSION
			};

			localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
		} catch (error) {
			console.error('Failed to persist GSM Evil state to localStorage:', error);

			// Handle quota exceeded
			if (error instanceof DOMException && error.name === 'QuotaExceededError') {
				console.warn('localStorage quota exceeded, clearing old data');
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	}

	return {
		subscribe,

		// Scan Results Management
		updateScanResults: (results: ScanResult[]) =>
			update((state) => {
				const newState = { ...state, scanResults: results };
				persistState(newState);
				return newState;
			}),

		setScanResults: (results: ScanResult[]) =>
			update((state) => {
				const newState = { ...state, scanResults: results };
				persistState(newState);
				return newState;
			}),

		addScanResult: (result: ScanResult) =>
			update((state) => {
				// Check if this frequency already exists, if so update it
				const existingIndex = state.scanResults.findIndex(
					(r) => r.frequency === result.frequency
				);
				let newResults;

				if (existingIndex >= 0) {
					// Update existing result
					newResults = [...state.scanResults];
					newResults[existingIndex] = result;
				} else {
					// Add new result
					newResults = [...state.scanResults, result];
				}

				const newState = { ...state, scanResults: newResults };
				persistState(newState);
				return newState;
			}),

		// Scan Progress Management
		addScanProgress: (message: string) =>
			update((state) => {
				const newState = {
					...state,
					scanProgress: [...state.scanProgress, message]
				};
				persistState(newState);
				return newState;
			}),

		setScanProgress: (progress: string[]) =>
			update((state) => {
				const newState = { ...state, scanProgress: progress };
				persistState(newState);
				return newState;
			}),

		clearScanProgress: () =>
			update((state) => {
				const newState = { ...state, scanProgress: [] };
				persistState(newState);
				return newState;
			}),

		// Status Management
		setScanStatus: (status: string) =>
			update((state) => {
				const newState = { ...state, scanStatus: status };
				persistState(newState);
				return newState;
			}),

		// Frequency Selection
		setSelectedFrequency: (frequency: string) =>
			update((state) => {
				const newState = { ...state, selectedFrequency: frequency };
				persistState(newState);
				return newState;
			}),

		// Scanning State
		setIsScanning: (isScanning: boolean) =>
			update((state) => {
				const newState = { ...state, isScanning };
				persistState(newState);
				return newState;
			}),

		// Show Progress
		setShowScanProgress: (show: boolean) =>
			update((state) => {
				const newState = { ...state, showScanProgress: show };
				persistState(newState);
				return newState;
			}),

		// IMSI Management
		setCapturedIMSIs: (imsis: any[]) =>
			update((state) => {
				const newState = {
					...state,
					capturedIMSIs: imsis,
					totalIMSIs: imsis.length
				};
				persistState(newState);
				return newState;
			}),

		addCapturedIMSI: (imsi: any) =>
			update((state) => {
				const newState = {
					...state,
					capturedIMSIs: [...state.capturedIMSIs, imsi],
					totalIMSIs: state.capturedIMSIs.length + 1
				};
				persistState(newState);
				return newState;
			}),

		// Tower Management
		setTowerLocations: (locations: { [key: string]: any }) =>
			update((state) => {
				const newState = { ...state, towerLocations: locations };
				persistState(newState);
				return newState;
			}),

		updateTowerLocation: (key: string, location: any) =>
			update((state) => {
				const newState = {
					...state,
					towerLocations: { ...state.towerLocations, [key]: location }
				};
				persistState(newState);
				return newState;
			}),

		setTowerLookupAttempted: (attempted: { [key: string]: boolean }) =>
			update((state) => {
				const newState = { ...state, towerLookupAttempted: attempted };
				persistState(newState);
				return newState;
			}),

		markTowerLookupAttempted: (key: string) =>
			update((state) => {
				const newState = {
					...state,
					towerLookupAttempted: { ...state.towerLookupAttempted, [key]: true }
				};
				persistState(newState);
				return newState;
			}),

		// Scan Control Methods
		startScan: () =>
			update((state) => {
				const abortController = new AbortController();
				const newState = {
					...state,
					isScanning: true,
					canStopScan: true,
					scanButtonText: 'Stop Scan',
					showScanProgress: true,
					scanAbortController: abortController,
					scanStatus: 'Starting scan...',
					scanProgress: ['[SCAN] Initializing GSM frequency scan...'],
					scanResults: [] // Clear previous scan results
				};
				persistState(newState);
				return newState;
			}),

		stopScan: () =>
			update((state) => {
				// Signal abort to any ongoing fetch operations
				if (state.scanAbortController) {
					state.scanAbortController.abort();
				}

				const newState = {
					...state,
					isScanning: false,
					canStopScan: false,
					scanButtonText: 'Start Scan',
					scanAbortController: null,
					scanStatus: 'Scan stopped by user',
					scanProgress: [...state.scanProgress, '[SCAN] Scan stopped by user']
				};
				persistState(newState);
				return newState;
			}),

		completeScan: () =>
			update((state) => {
				const newState = {
					...state,
					isScanning: false,
					canStopScan: false,
					scanButtonText: 'Start Scan',
					scanAbortController: null
				};
				persistState(newState);
				return newState;
			}),

		// Get abort controller for fetch operations
		getAbortController: (): AbortController | null => {
			let controller: AbortController | null = null;
			update((state) => {
				controller = state.scanAbortController;
				return state;
			});
			return controller;
		},

		// Clear Results (Manual Action - This is the "Clear Results" button functionality)
		clearResults: () =>
			update((state) => {
				const newState = {
					...defaultState,
					selectedFrequency: state.selectedFrequency, // Preserve frequency selection
					storageVersion: STORAGE_VERSION
				};
				persistState(newState);
				return newState;
			}),

		// Batch update for performance
		batchUpdate: (updates: Partial<GSMEvilState>) =>
			update((state) => {
				const newState = { ...state, ...updates };
				persistState(newState);
				return newState;
			}),

		// Complete state reset (for debugging/admin)
		reset: () => {
			set(defaultState);
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		},

		// Force persistence (useful for critical updates)
		forcePersist: () =>
			update((state) => {
				persistState(state);
				return state;
			}),

		// Get current state snapshot (for debugging)
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

export const gsmEvilStore = createGSMEvilStore();
