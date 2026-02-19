/**
 * Imperative map setup — adds Stadia-dependent layers, cursor handlers,
 * and initial layer visibility. Called once after MapLibre loads.
 */
import type maplibregl from 'maplibre-gl';

import { SatelliteLayer } from '$lib/map/layers/SatelliteLayer';
import { SymbolLayer } from '$lib/map/layers/SymbolLayer';

import { LAYER_MAP } from './map-helpers';

export interface MapSetupResult {
	satLayer: SatelliteLayer;
	symbolLayer: SymbolLayer;
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

	mapInstance.on('click', 'mil-sym-layer', (e) => {
		onDeviceClick(e as maplibregl.MapMouseEvent);
	});

	mapInstance.on('click', (e) => {
		const features = mapInstance.queryRenderedFeatures(e.point, {
			layers: [
				'device-circles',
				'device-clusters',
				'cell-tower-circles',
				'mil-sym-layer'
			].filter((l) => mapInstance.getLayer(l))
		});
		if (!features || features.length === 0) {
			onBackgroundClick(e);
		}
	});

	// Stadia-dependent vector layers (not available on Google satellite fallback)
	if (mapInstance.getSource('openmaptiles')) {
		if (!mapInstance.getLayer('building-outline-enhanced')) {
			mapInstance.addLayer(
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
		if (!mapInstance.getLayer('housenumber-labels')) {
			mapInstance.addLayer({
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
		if (!mapInstance.getLayer('poi-labels-all')) {
			mapInstance.addLayer({
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
	}

	// Pointer cursor for clickable layers
	for (const layer of [
		'device-clusters',
		'device-circles',
		'cell-tower-circles',
		'mil-sym-layer'
	]) {
		mapInstance.on('mouseenter', layer, () => {
			mapInstance.getCanvas().style.cursor = 'pointer';
		});
		mapInstance.on('mouseleave', layer, () => {
			mapInstance.getCanvas().style.cursor = '';
		});
	}

	// Apply initial layer visibility
	setTimeout(() => {
		for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
			const visible = layerVisibility[key] !== false;
			for (const id of layerIds) {
				if (mapInstance.getLayer(id)) {
					mapInstance.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
				}
			}
		}
	}, 200);

	return { satLayer, symbolLayer };
}
