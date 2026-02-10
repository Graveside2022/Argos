import { writable, type Writable } from 'svelte/store';
// Re-export canonical Leaflet types from $lib/types/map (Phase 0.6.2 backward compat)
export type { LeafletMap, LeafletMarker, LeafletCircle, LeafletCircleMarker } from '$lib/types/map';
import type { LeafletMap, LeafletMarker, LeafletCircle } from '$lib/types/map';

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
	mapStore.update((state) => ({ ...state, map, isInitialized: true }));
};

export const setUserMarker = (marker: LeafletMarker) => {
	mapStore.update((state) => ({ ...state, userMarker: marker }));
};

export const setAccuracyCircle = (circle: LeafletCircle) => {
	mapStore.update((state) => ({ ...state, accuracyCircle: circle }));
};
