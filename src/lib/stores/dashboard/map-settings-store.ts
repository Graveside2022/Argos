import { writable } from 'svelte/store';

export type MapProviderType = 'vector' | 'satellite' | 'custom';

export interface MapSourceConfig {
	name: string;
	type: MapProviderType;
	url: string; // URL template or style JSON URL
	attribution?: string;
}

export const DEFAULT_VECTOR_SOURCE: MapSourceConfig = {
	name: 'Tactical Dark',
	type: 'vector',
	url: '/api/map-tiles/styles/alidade_smooth_dark.json',
	attribution: '© Stadia Maps'
};

export const DEFAULT_SATELLITE_SOURCE: MapSourceConfig = {
	name: 'Satellite Hybrid',
	type: 'satellite',
	url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
	attribution: '© Google'
};

const initialState: MapSourceConfig = DEFAULT_VECTOR_SOURCE;

function createMapSettingsStore() {
	const { subscribe, set } = writable<MapSourceConfig>(initialState);

	return {
		subscribe,
		setProvider: (config: MapSourceConfig) => set(config),
		reset: () => set(DEFAULT_VECTOR_SOURCE)
	};
}

export const mapSettings = createMapSettingsStore();
