import { type Writable, writable } from 'svelte/store';

import { SimplifiedSignalSchema } from '$lib/schemas/stores';
import type { LeafletMarker } from '$lib/types/map';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export interface SimplifiedSignal {
	id: string;
	frequency: number;
	power: number;
	lat: number;
	lon: number;
	timestamp: number;
	count: number;
}

export interface HackRFState {
	isSearching: boolean;
	connectionStatus: 'Connected' | 'Disconnected';
	targetFrequency: number;
	signalCount: number;
	currentSignal: SimplifiedSignal | null;
	signals: Map<string, SimplifiedSignal>;
	signalMarkers: Map<string, LeafletMarker>;
}

const initialHackRFState: HackRFState = {
	isSearching: false,
	connectionStatus: 'Disconnected',
	targetFrequency: 2437, // Default WiFi channel 6
	signalCount: 0,
	currentSignal: null,
	signals: new Map(),
	signalMarkers: new Map()
};

export const hackrfStore: Writable<HackRFState> = writable(initialHackRFState);

// Helper functions to update store
export const setSearchingState = (isSearching: boolean) => {
	hackrfStore.update((state) => ({ ...state, isSearching }));
};

export const setConnectionStatus = (status: 'Connected' | 'Disconnected') => {
	hackrfStore.update((state) => ({ ...state, connectionStatus: status }));
};

export const setTargetFrequency = (frequency: number) => {
	hackrfStore.update((state) => ({ ...state, targetFrequency: frequency }));
};

export const updateSignalCount = (count: number) => {
	hackrfStore.update((state) => ({ ...state, signalCount: count }));
};

export const setCurrentSignal = (signal: SimplifiedSignal | null) => {
	// Validate signal before setting as current (T040)
	if (signal !== null) {
		const validated = safeParseWithHandling(SimplifiedSignalSchema, signal, 'background');
		if (!validated) {
			logger.error(
				'Invalid signal data for setCurrentSignal',
				{ signal },
				'signal-validation-failed'
			);
			return;
		}
		hackrfStore.update((state) => ({ ...state, currentSignal: validated }));
	} else {
		hackrfStore.update((state) => ({ ...state, currentSignal: null }));
	}
};

export const addSignal = (signal: SimplifiedSignal) => {
	// Validate signal before adding to store (T040)
	const validated = safeParseWithHandling(SimplifiedSignalSchema, signal, 'background');
	if (!validated) {
		logger.error('Invalid signal data for addSignal', { signal }, 'signal-validation-failed');
		return;
	}

	hackrfStore.update((state) => {
		const newSignals = new Map(state.signals);
		newSignals.set(validated.id, validated);
		return {
			...state,
			signals: newSignals,
			signalCount: newSignals.size
		};
	});
};

export const updateSignal = (signalId: string, updates: Partial<SimplifiedSignal>) => {
	// Validate updated signal data before applying (T040)
	hackrfStore.update((state) => {
		const newSignals = new Map(state.signals);
		const existingSignal = newSignals.get(signalId);
		if (existingSignal) {
			const mergedSignal = { ...existingSignal, ...updates };
			const validated = safeParseWithHandling(
				SimplifiedSignalSchema,
				mergedSignal,
				'background'
			);
			if (!validated) {
				logger.error(
					'Invalid signal update data',
					{ signalId, updates },
					'signal-update-validation-failed'
				);
				return state; // Return unchanged state if validation fails
			}
			newSignals.set(signalId, validated);
		}
		return { ...state, signals: newSignals };
	});
};

export const removeSignal = (signalId: string) => {
	hackrfStore.update((state) => {
		const newSignals = new Map(state.signals);
		newSignals.delete(signalId);
		return {
			...state,
			signals: newSignals,
			signalCount: newSignals.size
		};
	});
};

export const clearAllSignals = () => {
	hackrfStore.update((state) => ({
		...state,
		signals: new Map(),
		signalMarkers: new Map(),
		signalCount: 0,
		currentSignal: null
	}));
};

export const addSignalMarker = (signalId: string, marker: LeafletMarker) => {
	hackrfStore.update((state) => {
		const newMarkers = new Map(state.signalMarkers);
		newMarkers.set(signalId, marker);
		return { ...state, signalMarkers: newMarkers };
	});
};

export const removeSignalMarker = (signalId: string) => {
	hackrfStore.update((state) => {
		const newMarkers = new Map(state.signalMarkers);
		newMarkers.delete(signalId);
		return { ...state, signalMarkers: newMarkers };
	});
};

export const clearAllSignalMarkers = () => {
	hackrfStore.update((state) => ({
		...state,
		signalMarkers: new Map()
	}));
};
