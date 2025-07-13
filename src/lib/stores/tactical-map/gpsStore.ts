import { writable, type Writable } from 'svelte/store';

export interface GPSPosition {
	lat: number;
	lon: number;
}

export interface GPSStatus {
	hasGPSFix: boolean;
	gpsStatus: string;
	accuracy: number;
	satellites: number;
	fixType: string;
	currentCountry: { name: string; flag: string };
	formattedCoords: { lat: string; lon: string };
	mgrsCoord: string;
}

export interface GPSState {
	position: GPSPosition;
	status: GPSStatus;
}

const initialGPSState: GPSState = {
	position: { lat: 0, lon: 0 },
	status: {
		hasGPSFix: false,
		gpsStatus: 'Requesting GPS...',
		accuracy: 0,
		satellites: 0,
		fixType: 'No',
		currentCountry: { name: 'Unknown', flag: '🌍' },
		formattedCoords: { lat: '0.000000°N', lon: '0.000000°E' },
		mgrsCoord: 'Invalid'
	}
};

export const gpsStore: Writable<GPSState> = writable(initialGPSState);

export const updateGPSPosition = (position: GPSPosition) => {
	gpsStore.update(state => ({ ...state, position }));
};

export const updateGPSStatus = (status: Partial<GPSStatus>) => {
	gpsStore.update(state => ({ 
		...state, 
		status: { ...state.status, ...status } 
	}));
};