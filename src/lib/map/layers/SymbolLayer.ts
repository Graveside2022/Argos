import type { Feature } from 'geojson';
import type maplibregl from 'maplibre-gl';

import { SymbolFactory } from '../symbols/SymbolFactory';

export class SymbolLayer {
	private map: maplibregl.Map;
	private symbolCache: Set<string> = new Set();
	private sourceId = 'mil-sym-source';
	private layerId = 'mil-sym-layer';

	constructor(map: maplibregl.Map) {
		this.map = map;
		this.initialize();
	}

	private initialize() {
		if (!this.map.getSource(this.sourceId)) {
			this.map.addSource(this.sourceId, {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
		}

		if (!this.map.getLayer(this.layerId)) {
			this.map.addLayer({
				id: this.layerId,
				type: 'symbol',
				source: this.sourceId,
				layout: {
					'icon-image': ['get', 'sidc'],
					'icon-size': 1.0,
					'icon-allow-overlap': true,
					'text-field': ['get', 'label'],
					'text-font': ['Stadia Regular'],
					'text-size': 12,
					'text-offset': [0, 1.5],
					'text-anchor': 'top'
				},
				paint: {
					// MapLibre GL paint operates on WebGL canvas — CSS variables unsupported.
					// Values match --palantir-text-primary (light on dark) for dark-only tactical theme.
					'text-color': 'hsl(0, 0%, 100%)',
					'text-halo-color': 'hsl(0, 0%, 0%)',
					'text-halo-width': 1
				}
			});
		}
	}

	/**
	 * Updates the map with a new set of devices, generating symbols as needed.
	 * @param features GeoJSON features containing 'sidc' and 'label' properties
	 */
	public update(features: Feature[]) {
		// Symbol update count tracked via feature array length
		// 1. Identify new SIDC codes
		features.forEach((f) => {
			const sidc = f.properties?.sidc;
			if (sidc && !this.symbolCache.has(sidc)) {
				// New SIDC detected — generate symbol image
				this.addSymbolImage(sidc);
			}
		});

		// 2. Update Source
		const source = this.map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
		if (source) {
			source.setData({
				type: 'FeatureCollection',
				features: features
			});
		} else {
			console.warn('[SymbolLayer] Source not found during update!');
		}
	}

	private addSymbolImage(sidc: string) {
		if (this.map.hasImage(sidc)) return;

		try {
			const dataUrl = SymbolFactory.createSymbolDataUrl(sidc, { size: 32 });
			if (!dataUrl) {
				console.warn(`[SymbolLayer] Empty render for SIDC: ${sidc}`);
				return;
			}

			const img = new Image();
			img.onload = () => {
				if (!this.map.hasImage(sidc)) {
					this.map.addImage(sidc, img);
				}
				this.symbolCache.add(sidc);
			};
			img.src = dataUrl;
		} catch (error) {
			console.error(`[SymbolLayer] Error generating symbol for SIDC: ${sidc}`, error);
		}
	}

	public setVisible(visible: boolean) {
		if (this.map.getLayer(this.layerId)) {
			this.map.setLayoutProperty(this.layerId, 'visibility', visible ? 'visible' : 'none');
		}
	}

	/**
	 * Clears the layer and cache
	 */
	public clear() {
		// Technically we can't easily remove images from sprite without recreating style?
		// MapLibre has removeImage()
		this.symbolCache.forEach((sidc) => {
			if (this.map.hasImage(sidc)) this.map.removeImage(sidc);
		});
		this.symbolCache.clear();

		const source = this.map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
		if (source) {
			source.setData({ type: 'FeatureCollection', features: [] });
		}
	}
}
