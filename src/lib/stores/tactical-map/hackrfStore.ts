import { writable, type Writable } from 'svelte/store';

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
	signalMarkers: Map<string, any>; // Leaflet markers
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
	hackrfStore.update(state => ({ ...state, isSearching }));
};

export const setConnectionStatus = (status: 'Connected' | 'Disconnected') => {
	hackrfStore.update(state => ({ ...state, connectionStatus: status }));
};

export const setTargetFrequency = (frequency: number) => {
	hackrfStore.update(state => ({ ...state, targetFrequency: frequency }));
};

export const updateSignalCount = (count: number) => {
	hackrfStore.update(state => ({ ...state, signalCount: count }));
};

export const setCurrentSignal = (signal: SimplifiedSignal | null) => {
	hackrfStore.update(state => ({ ...state, currentSignal: signal }));
};

export const addSignal = (signal: SimplifiedSignal) => {
	hackrfStore.update(state => {
		const newSignals = new Map(state.signals);
		newSignals.set(signal.id, signal);
		return { 
			...state, 
			signals: newSignals,
			signalCount: newSignals.size 
		};
	});
};

export const updateSignal = (signalId: string, updates: Partial<SimplifiedSignal>) => {
	hackrfStore.update(state => {
		const newSignals = new Map(state.signals);
		const existingSignal = newSignals.get(signalId);
		if (existingSignal) {
			newSignals.set(signalId, { ...existingSignal, ...updates });
		}
		return { ...state, signals: newSignals };
	});
};

export const removeSignal = (signalId: string) => {
	hackrfStore.update(state => {
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
	hackrfStore.update(state => ({
		...state,
		signals: new Map(),
		signalMarkers: new Map(),
		signalCount: 0,
		currentSignal: null
	}));
};

export const addSignalMarker = (signalId: string, marker: any) => {
	hackrfStore.update(state => {
		const newMarkers = new Map(state.signalMarkers);
		newMarkers.set(signalId, marker);
		return { ...state, signalMarkers: newMarkers };
	});
};

export const removeSignalMarker = (signalId: string) => {
	hackrfStore.update(state => {
		const newMarkers = new Map(state.signalMarkers);
		newMarkers.delete(signalId);
		return { ...state, signalMarkers: newMarkers };
	});
};

export const clearAllSignalMarkers = () => {
	hackrfStore.update(state => ({
		...state,
		signalMarkers: new Map()
	}));
};