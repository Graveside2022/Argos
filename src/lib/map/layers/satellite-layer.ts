import type { Map } from 'maplibre-gl';

export class SatelliteLayer {
	private map: Map;
	private readonly SOURCE_ID = 'satellite-hybrid-source';
	private readonly LAYER_ID = 'satellite-hybrid-layer';

	constructor(map: Map) {
		this.map = map;
	}

	/** IDs of overlay layers the satellite raster should be inserted below */
	private static readonly OVERLAY_LAYER_IDS = new Set([
		'mil-sym-layer',
		'device-circles',
		'device-clusters',
		'connection-lines'
	]);

	/** Find the first overlay or label layer to insert before */
	private findInsertionPoint(): string | undefined {
		const layers = this.map.getStyle()?.layers ?? [];
		return layers.find(
			(l) => SatelliteLayer.OVERLAY_LAYER_IDS.has(l.id) || l.id.includes('label')
		)?.id;
	}

	/**
	 * Adds the Google Hybrid Satellite layer to the map.
	 * @param urlTemplate The XYZ URL template (e.g., Google Maps or custom).
	 * @param attribution Attribution text for the source.
	 */
	add(urlTemplate: string, attribution: string = '© Google') {
		if (this.map.getSource(this.SOURCE_ID)) return;

		this.map.addSource(this.SOURCE_ID, {
			type: 'raster',
			tiles: [urlTemplate],
			tileSize: 256,
			attribution
		});

		this.map.addLayer(
			{
				id: this.LAYER_ID,
				type: 'raster',
				source: this.SOURCE_ID,
				paint: { 'raster-opacity': 0 },
				layout: { visibility: 'none' }
			},
			this.findInsertionPoint()
		);
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
