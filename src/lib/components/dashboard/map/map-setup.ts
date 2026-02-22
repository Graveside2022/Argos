/**
 * Imperative map setup — adds Stadia-dependent layers, cursor handlers,
 * and initial layer visibility. Called once after MapLibre loads.
 */
import type maplibregl from 'maplibre-gl';

import { SatelliteLayer } from '$lib/map/layers/satellite-layer';
import { SymbolLayer } from '$lib/map/layers/symbol-layer';

import { LAYER_MAP } from './map-helpers';

export interface MapSetupResult {
	satLayer: SatelliteLayer;
	symbolLayer: SymbolLayer;
}

/** Clickable layer IDs used for hit-testing and cursor changes. */
const CLICKABLE_LAYERS = [
	'device-circles',
	'device-clusters',
	'cell-tower-circles',
	'mil-sym-layer'
] as const;

/**
 * Register click handlers for device selection and background deselection.
 * Symbol-layer clicks fire onDeviceClick; clicks on empty space fire onBackgroundClick.
 */
function registerClickHandlers(
	map: maplibregl.Map,
	onDeviceClick: (e: maplibregl.MapMouseEvent) => void,
	onBackgroundClick: (e: maplibregl.MapMouseEvent) => void
): void {
	map.on('click', 'mil-sym-layer', (e) => {
		onDeviceClick(e as maplibregl.MapMouseEvent);
	});

	map.on('click', (e) => {
		const features = map.queryRenderedFeatures(e.point, {
			layers: [...CLICKABLE_LAYERS].filter((l) => map.getLayer(l))
		});
		if (!features || features.length === 0) {
			onBackgroundClick(e);
		}
	});
}

/**
 * Add building outline and house number label layers when the Stadia
 * openmaptiles vector source is available. Skips layers that already exist.
 */
function addBuildingAndHousenumberLayers(map: maplibregl.Map): void {
	if (!map.getLayer('building-outline-enhanced')) {
		map.addLayer(
			{
				id: 'building-outline-enhanced',
				type: 'line',
				source: 'openmaptiles',
				'source-layer': 'building',
				minzoom: 15,
				paint: { 'line-color': 'hsla(0, 0%, 50%, 0.3)', 'line-width': 0.5 }
			},
			'poi_gen1'
		);
	}
	if (!map.getLayer('housenumber-labels')) {
		map.addLayer({
			id: 'housenumber-labels',
			type: 'symbol',
			source: 'openmaptiles',
			'source-layer': 'housenumber',
			minzoom: 17,
			layout: {
				'text-field': ['get', 'housenumber'],
				'text-font': ['Stadia Regular'],
				'text-size': 10,
				'text-anchor': 'center',
				'text-optional': true,
				'text-allow-overlap': false
			},
			paint: {
				'text-color': '#7a8290',
				'text-halo-color': '#111119',
				'text-halo-width': 1,
				'text-halo-blur': 0.5
			}
		});
	}
}

/**
 * Add POI (point-of-interest) text labels from the Stadia openmaptiles
 * vector source. Shows name labels at zoom 14+ with halo for readability.
 */
function addPoiLabelsLayer(map: maplibregl.Map): void {
	if (map.getLayer('poi-labels-all')) return;

	map.addLayer({
		id: 'poi-labels-all',
		type: 'symbol',
		source: 'openmaptiles',
		'source-layer': 'poi',
		minzoom: 14,
		filter: ['any', ['has', 'name:latin'], ['has', 'name']],
		layout: {
			'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
			'text-font': ['Stadia Regular'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
			'text-anchor': 'top',
			'text-offset': [0, 0.6],
			'text-max-width': 8,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-padding': 2
		},
		paint: {
			'text-color': '#b0b8c4',
			'text-halo-color': '#111119',
			'text-halo-width': 1.5,
			'text-halo-blur': 0.5
		}
	});
}

/**
 * Set pointer cursor on mouseenter for all clickable feature layers,
 * and reset it on mouseleave.
 */
function registerCursorHandlers(map: maplibregl.Map): void {
	for (const layer of CLICKABLE_LAYERS) {
		map.on('mouseenter', layer, () => {
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', layer, () => {
			map.getCanvas().style.cursor = '';
		});
	}
}

/**
 * Once the map reaches idle state, apply the caller-provided layer
 * visibility map so toggled-off layers start hidden.
 */
function applyInitialLayerVisibility(
	map: maplibregl.Map,
	layerVisibility: Record<string, boolean>
): void {
	map.once('idle', () => {
		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			const visible = layerVisibility[key] !== false;
			for (const id of layerIds) {
				if (map.getLayer(id)) {
					map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
				}
			}
		}
	});
}

/**
 * Initialize satellite + symbol layers, add Stadia-dependent vector layers,
 * and set up cursor interaction handlers.
 */
export function setupMap(
	mapInstance: maplibregl.Map,
	onDeviceClick: (e: maplibregl.MapMouseEvent) => void,
	onBackgroundClick: (e: maplibregl.MapMouseEvent) => void,
	layerVisibility: Record<string, boolean>
): MapSetupResult {
	const satLayer = new SatelliteLayer(mapInstance);
	const symbolLayer = new SymbolLayer(mapInstance);

	registerClickHandlers(mapInstance, onDeviceClick, onBackgroundClick);

	// Stadia-dependent vector layers (not available on Google satellite fallback)
	if (mapInstance.getSource('openmaptiles')) {
		addBuildingAndHousenumberLayers(mapInstance);
		addPoiLabelsLayer(mapInstance);
	}

	registerCursorHandlers(mapInstance);
	applyInitialLayerVisibility(mapInstance, layerVisibility);

	return { satLayer, symbolLayer };
}
