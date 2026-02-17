import type { LayerSpecification, Map, RasterSourceSpecification } from 'maplibre-gl';

export class SatelliteLayer {
	private map: Map;
	private readonly SOURCE_ID = 'satellite-hybrid-source';
	private readonly LAYER_ID = 'satellite-hybrid-layer';

	constructor(map: Map) {
		this.map = map;
	}

	/**
	 * Adds the Google Hybrid Satellite layer to the map.
	 * @param urlTemplate The XYZ URL template (e.g., Google Maps or custom).
	 * @param attribution Attribution text for the source.
	 */
	add(urlTemplate: string, attribution: string = '© Google') {
		if (this.map.getSource(this.SOURCE_ID)) {
			return;
		}

		const source: RasterSourceSpecification = {
			type: 'raster',
			tiles: [urlTemplate],
			tileSize: 256,
			attribution: attribution
		};

		this.map.addSource(this.SOURCE_ID, source);

		const layer: LayerSpecification = {
			id: this.LAYER_ID,
			type: 'raster',
			source: this.SOURCE_ID,
			paint: {
				'raster-opacity': 0 // Start hidden, toggle via visibility
			},
			layout: {
				visibility: 'none'
			}
		};

		// Add before symbols/circles so they remain visible on top
		const layers = this.map.getStyle()?.layers || [];

		// Find the first layer that is one of our known overlays
		// Prioritize specific layers to insert before
		const beforeId = layers.find(
			(l) =>
				l.id === 'mil-sym-layer' ||
				l.id === 'device-circles' ||
				l.id === 'device-clusters' ||
				l.id === 'connection-lines' ||
				l.id.includes('label') // Try to put satellite below labels if possible
		)?.id;

		this.map.addLayer(layer, beforeId);
	}

	/**
	 * Toggles the visibility of the satellite layer.
	 * @param visible Whether the layer should be visible.
	 */
	setVisible(visible: boolean) {
		if (!this.map.getLayer(this.LAYER_ID)) return;

		const value = visible ? 'visible' : 'none';
		this.map.setLayoutProperty(this.LAYER_ID, 'visibility', value);

		// Also fade in/out for smoother transition if supported
		this.map.setPaintProperty(this.LAYER_ID, 'raster-opacity', visible ? 1 : 0);
	}

	/**
	 * Updates the source URL (requiring remove/add source).
	 */
	updateSource(urlTemplate: string, attribution: string) {
		if (this.map.getLayer(this.LAYER_ID)) {
			this.map.removeLayer(this.LAYER_ID);
		}
		if (this.map.getSource(this.SOURCE_ID)) {
			this.map.removeSource(this.SOURCE_ID);
		}
		this.add(urlTemplate, attribution);
	}
}
