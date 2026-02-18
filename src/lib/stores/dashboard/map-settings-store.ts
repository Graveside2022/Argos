import type { StyleSpecification } from 'maplibre-gl';
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

// Minimal MapLibre style spec for Google satellite tiles — used when Stadia is not configured.
// Raster tiles from mt0-mt3.google.com; glyphs from demotiles.maplibre.org for label rendering.
export const GOOGLE_SATELLITE_STYLE: StyleSpecification = {
	version: 8,
	name: 'Google Satellite Fallback',
	glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
	sources: {
		'google-satellite': {
			type: 'raster',
			tiles: [
				'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
				'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
			],
			tileSize: 256,
			attribution: '© Google'
		}
	},
	layers: [
		{
			id: 'google-satellite-layer',
			type: 'raster',
			source: 'google-satellite'
		}
	]
};

const initialState: MapSourceConfig = DEFAULT_VECTOR_SOURCE;

function createMapSettingsStore() {
	const { subscribe, set } = writable<MapSourceConfig>(initialState);
	const stadiaAvailable = writable<boolean>(false);

	return {
		subscribe,
		setProvider: (config: MapSourceConfig) => set(config),
		reset: () => set(DEFAULT_VECTOR_SOURCE),
		stadiaAvailable: {
			subscribe: stadiaAvailable.subscribe,
			set: stadiaAvailable.set
		}
	};
}

export const mapSettings = createMapSettingsStore();
