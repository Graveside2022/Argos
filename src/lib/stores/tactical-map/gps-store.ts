import { type Writable, writable } from 'svelte/store';

import { GPSPositionSchema, GPSStatusSchema } from '$lib/schemas/stores';
import { logger } from '$lib/utils/logger';
import { safeParseWithHandling } from '$lib/utils/validation-error';

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
	heading: number | null;
	speed: number | null;
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
		heading: null,
		speed: null,
		currentCountry: { name: 'Unknown', flag: '[GLOBE]' },
		formattedCoords: { lat: '0.000000°N', lon: '0.000000°E' },
		mgrsCoord: 'Invalid'
	}
};

export const gpsStore: Writable<GPSState> = writable(initialGPSState);

export const updateGPSPosition = (position: GPSPosition) => {
	// Validate GPS position before updating store (T039)
	const validated = safeParseWithHandling(GPSPositionSchema, position, 'background');
	if (!validated) {
		logger.error('Invalid GPS position data', { position }, 'gps-position-validation-failed');
		return;
	}
	gpsStore.update((state) => ({ ...state, position: validated }));
};

export const updateGPSStatus = (status: Partial<GPSStatus>) => {
	// Validate GPS status update before applying to store (T039)
	// For partial updates, merge with existing state first, then validate
	gpsStore.update((state) => {
		const mergedStatus = { ...state.status, ...status };
		const validated = safeParseWithHandling(GPSStatusSchema, mergedStatus, 'background');
		if (!validated) {
			logger.error('Invalid GPS status data', { status }, 'gps-status-validation-failed');
			return state; // Return unchanged state if validation fails
		}
		return { ...state, status: validated };
	});
};
