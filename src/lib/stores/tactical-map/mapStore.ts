import { writable, type Writable } from 'svelte/store';

export interface LeafletMap {
	setView: (center: [number, number], zoom: number) => LeafletMap;
	attributionControl: {
		setPrefix: (prefix: string) => void;
	};
	addLayer: (layer: unknown) => void;
	removeLayer: (layer: unknown) => void;
	on: (event: string, callback: (e: unknown) => void) => void;
}

export interface LeafletMarker {
	addTo: (map: LeafletMap) => LeafletMarker;
	setLatLng: (latlng: [number, number]) => LeafletMarker;
	bindPopup: (content: string) => LeafletMarker;
	remove: () => void;
}

export interface LeafletCircle {
	addTo: (map: LeafletMap) => LeafletCircle;
	setLatLng: (latlng: [number, number]) => LeafletCircle;
	setRadius: (radius: number) => LeafletCircle;
	remove: () => void;
}

export interface LeafletCircleMarker {
	addTo: (map: LeafletMap) => LeafletCircleMarker;
	setLatLng: (latlng: [number, number]) => LeafletCircleMarker;
	bindPopup: (content: string) => LeafletCircleMarker;
	remove: () => void;
}

export interface MapState {
	map: LeafletMap | null;
	userMarker: LeafletMarker | null;
	accuracyCircle: LeafletCircle | null;
	isInitialized: boolean;
}

const initialMapState: MapState = {
	map: null,
	userMarker: null,
	accuracyCircle: null,
	isInitialized: false
};

export const mapStore: Writable<MapState> = writable(initialMapState);

export const setMap = (map: LeafletMap) => {
	mapStore.update(state => ({ ...state, map, isInitialized: true }));
};

export const setUserMarker = (marker: LeafletMarker) => {
	mapStore.update(state => ({ ...state, userMarker: marker }));
};

export const setAccuracyCircle = (circle: LeafletCircle) => {
	mapStore.update(state => ({ ...state, accuracyCircle: circle }));
};