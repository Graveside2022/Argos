/**
 * RTL_433 Persistent State Store
 * Provides centralized state management with localStorage persistence
 * for RTL_433 signal capture and related data.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rtl433-state';
const STORAGE_VERSION = '1.0';

export interface CapturedSignal {
	time: string;
	model?: string;
	id?: string;
	channel?: number;
	battery_ok?: boolean;
	temperature_C?: number;
	humidity?: number;
	pressure_hPa?: number;
	wind_avg_km_h?: number;
	wind_dir_deg?: number;
	rain_mm?: number;
	[key: string]: any; // Allow for any additional signal data
}

export interface RTL433State {
	// Core signal data
	capturedSignals: CapturedSignal[];
	totalSignals: number;

	// Configuration
	selectedFrequency: string;
	selectedSampleRate: string;
	selectedFormat: string;
	enabledProtocols: string[];

	// Console output
	consoleOutput: string[];
	showConsole: boolean;

	// Metadata
	lastCaptureTime: string | null;
	storageVersion: string;
}

const defaultState: RTL433State = {
	capturedSignals: [],
	totalSignals: 0,
	selectedFrequency: '868',
	selectedSampleRate: '1024000',
	selectedFormat: 'json',
	enabledProtocols: [],
	consoleOutput: [],
	showConsole: false,
	lastCaptureTime: null,
	storageVersion: STORAGE_VERSION
};

function createRTL433Store() {
	const { subscribe, set, update } = writable<RTL433State>(defaultState);

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
					console.warn('RTL_433 state version mismatch, resetting to default');
					localStorage.removeItem(STORAGE_KEY);
					return;
				}

				// Merge with defaults to handle missing properties
				const mergedState = { ...defaultState, ...parsedState };
				set(mergedState);
			}
		} catch (error) {
			console.error('Failed to load RTL_433 state from localStorage:', error);
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	function persistState(state: RTL433State) {
		if (!browser) return;

		try {
			// Create a clean state object for persistence
			const stateToSave = {
				...state,
				lastCaptureTime: new Date().toISOString(),
				storageVersion: STORAGE_VERSION
			};

			localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
		} catch (error) {
			console.error('Failed to persist RTL_433 state to localStorage:', error);

			// Handle quota exceeded
			if (error instanceof DOMException && error.name === 'QuotaExceededError') {
				console.warn('localStorage quota exceeded, clearing old data');
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	}

	return {
		subscribe,

		// Signal Management
		addCapturedSignal: (signal: CapturedSignal) =>
			update((state) => {
				const newSignals = [...state.capturedSignals, signal].slice(-1000);
				const newState = {
					...state,
					capturedSignals: newSignals,
					totalSignals: state.totalSignals + 1
				};
				persistState(newState);
				return newState;
			}),

		setCapturedSignals: (signals: CapturedSignal[]) =>
			update((state) => {
				const newState = {
					...state,
					capturedSignals: signals,
					totalSignals: signals.length
				};
				persistState(newState);
				return newState;
			}),

		clearCapturedSignals: () =>
			update((state) => {
				const newState = {
					...state,
					capturedSignals: [],
					totalSignals: 0
				};
				persistState(newState);
				return newState;
			}),

		// Configuration Management
		setSelectedFrequency: (frequency: string) =>
			update((state) => {
				const newState = { ...state, selectedFrequency: frequency };
				persistState(newState);
				return newState;
			}),

		setSelectedSampleRate: (sampleRate: string) =>
			update((state) => {
				const newState = { ...state, selectedSampleRate: sampleRate };
				persistState(newState);
				return newState;
			}),

		setSelectedFormat: (format: string) =>
			update((state) => {
				const newState = { ...state, selectedFormat: format };
				persistState(newState);
				return newState;
			}),

		setEnabledProtocols: (protocols: string[]) =>
			update((state) => {
				const newState = { ...state, enabledProtocols: protocols };
				persistState(newState);
				return newState;
			}),

		// Console Output Management
		addConsoleOutput: (message: string) =>
			update((state) => {
				// Limit console output to prevent memory issues
				const maxLines = 1000;
				const newOutput = [...state.consoleOutput, message];
				if (newOutput.length > maxLines) {
					newOutput.splice(0, newOutput.length - maxLines);
				}

				const newState = { ...state, consoleOutput: newOutput };
				persistState(newState);
				return newState;
			}),

		setConsoleOutput: (output: string[]) =>
			update((state) => {
				const newState = { ...state, consoleOutput: output };
				persistState(newState);
				return newState;
			}),

		clearConsoleOutput: () =>
			update((state) => {
				const newState = { ...state, consoleOutput: [] };
				persistState(newState);
				return newState;
			}),

		setShowConsole: (show: boolean) =>
			update((state) => {
				const newState = { ...state, showConsole: show };
				persistState(newState);
				return newState;
			}),

		// Batch update for performance
		batchUpdate: (updates: Partial<RTL433State>) =>
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
			let currentState: RTL433State = defaultState;
			update((state) => {
				currentState = state;
				return state;
			});
			return currentState;
		}
	};
}

export const rtl433Store = createRTL433Store();
