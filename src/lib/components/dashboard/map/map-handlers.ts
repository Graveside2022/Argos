/**
 * Map click/interaction handlers for DashboardMap.
 *
 * Extracted to keep the Svelte component under 300 lines.
 * Each handler receives the map instance and any mutable state references
 * it needs, rather than closing over component-level variables.
 */
import type { Feature, FeatureCollection } from 'geojson';
import type { LngLatLike } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

import type { SymbolLayer } from '$lib/map/layers/SymbolLayer';
import { SymbolFactory } from '$lib/map/symbols/SymbolFactory';
import type { Affiliation } from '$lib/stores/tactical-map/kismet-store';
import { parseCotToFeature } from '$lib/utils/cot-parser';

import { MAP_UI_COLORS, resolveMapColor, SIGNAL_COLORS } from './map-colors';
import type { RangeBand } from './map-geojson';
import { fetchCellTowers, haversineKm, LAYER_MAP } from './map-helpers';

// ── Device click handler ──

export interface PopupState {
	ssid: string;
	mac: string;
	rssi: number;
	type: string;
	manufacturer: string;
	channel: number;
	frequency: number;
	packets: number;
	last_seen: number;
	clientCount: number;
	parentAP: string;
	affiliation: Affiliation;
}

export function handleDeviceClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent,
	affiliations: Map<string, Affiliation>
): { lngLat: LngLatLike; content: PopupState } | null {
	const features = map.queryRenderedFeatures(ev.point, {
		layers: ['device-circles', 'mil-sym-layer'].filter((l) => map.getLayer(l))
	});
	if (!features?.length) return null;
	const props = features[0].properties,
		geom = features[0].geometry;
	if (geom.type !== 'Point') return null;
	return {
		lngLat: geom.coordinates as [number, number],
		content: {
			ssid: props?.ssid ?? 'Unknown',
			mac: props?.mac ?? '',
			rssi: props?.rssi ?? -80,
			type: props?.type ?? 'unknown',
			manufacturer: props?.manufacturer ?? 'Unknown',
			channel: props?.channel ?? 0,
			frequency: props?.frequency ?? 0,
			packets: props?.packets ?? 0,
			last_seen: props?.last_seen ?? 0,
			clientCount: props?.clientCount ?? 0,
			parentAP: props?.parentAP ?? '',
			affiliation: affiliations.get((props?.mac ?? '').toUpperCase()) || 'unknown'
		}
	};
}

// ── Cluster click handler ──

export async function handleClusterClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent
): Promise<void> {
	const features = map.queryRenderedFeatures(ev.point, { layers: ['device-clusters'] });
	if (!features?.length) return;
	const clusterId = features[0].properties?.cluster_id;
	if (clusterId === undefined) return;
	const source = map.getSource('devices-src') as maplibregl.GeoJSONSource;
	if (!source) return;
	try {
		const zoom = await source.getClusterExpansionZoom(clusterId);
		const geom = features[0].geometry;
		if (geom.type === 'Point')
			map.easeTo({
				center: geom.coordinates as [number, number],
				zoom: Math.min(zoom, 18)
			});
	} catch {
		/* cluster removed */
	}
}

// ── Tower click handler ──

export interface TowerPopupState {
	radio: string;
	mcc: number;
	mnc: number;
	lac: number;
	ci: number;
	range: number;
	samples: number;
	avgSignal: number;
}

export function handleTowerClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent
): { lngLat: LngLatLike; content: TowerPopupState } | null {
	const features = map.queryRenderedFeatures(ev.point, { layers: ['cell-tower-circles'] });
	if (!features?.length) return null;
	const props = features[0].properties,
		geom = features[0].geometry;
	if (geom.type !== 'Point') return null;
	return {
		lngLat: geom.coordinates as [number, number],
		content: {
			radio: props?.radio ?? 'Unknown',
			mcc: props?.mcc ?? 0,
			mnc: props?.mnc ?? 0,
			lac: props?.lac ?? 0,
			ci: props?.ci ?? 0,
			range: props?.range ?? 0,
			samples: props?.samples ?? 0,
			avgSignal: props?.avgSignal ?? 0
		}
	};
}

// ── Layer visibility sync ──

export function syncLayerVisibility(
	map: maplibregl.Map,
	vis: Record<string, boolean>,
	isoMac: string | null,
	symbolLayer?: SymbolLayer
): void {
	if (symbolLayer) symbolLayer.setVisible(vis.milSyms !== false);
	for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
		const visible =
			key === 'connectionLines' ? vis[key] !== false || isoMac !== null : vis[key] !== false;
		for (const id of layerIds) {
			if (map.getLayer(id))
				map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
		}
	}
}

// ── Cluster visibility sync ──

export function syncClusterVisibility(
	map: maplibregl.Map,
	isoMac: string | null,
	dotsVisible: boolean
): void {
	const clusterVis = isoMac ? 'none' : dotsVisible ? 'visible' : 'none';
	if (map.getLayer('device-clusters'))
		map.setLayoutProperty('device-clusters', 'visibility', clusterVis);
	if (map.getLayer('device-cluster-count'))
		map.setLayoutProperty('device-cluster-count', 'visibility', clusterVis);
}

// ── Theme paint sync ──

export function syncThemePaint(map: maplibregl.Map): void {
	const fg = resolveMapColor(MAP_UI_COLORS.foreground),
		mutedFg = resolveMapColor(MAP_UI_COLORS.mutedForeground),
		bg = resolveMapColor(MAP_UI_COLORS.background),
		secondary = resolveMapColor(MAP_UI_COLORS.secondary),
		border = resolveMapColor(MAP_UI_COLORS.border);
	if (map.getLayer('device-clusters')) {
		map.setPaintProperty('device-clusters', 'circle-color', secondary);
		map.setPaintProperty('device-clusters', 'circle-stroke-color', border);
	}
	if (map.getLayer('device-cluster-count'))
		map.setPaintProperty('device-cluster-count', 'text-color', fg);
	if (map.getLayer('cell-tower-labels')) {
		map.setPaintProperty('cell-tower-labels', 'text-color', mutedFg);
		map.setPaintProperty('cell-tower-labels', 'text-halo-color', bg);
	}
	if (map.getLayer('housenumber-labels')) {
		map.setPaintProperty('housenumber-labels', 'text-color', mutedFg);
		map.setPaintProperty('housenumber-labels', 'text-halo-color', bg);
	}
	if (map.getLayer('poi-labels-all')) {
		map.setPaintProperty('poi-labels-all', 'text-color', fg);
		map.setPaintProperty('poi-labels-all', 'text-halo-color', bg);
	}
	if (map.getLayer('building-outline-enhanced'))
		map.setPaintProperty('building-outline-enhanced', 'line-color', `${border}4D`);
}

// ── Symbol layer update ──

export function updateSymbolLayer(
	symbolLayer: SymbolLayer,
	deviceGeoJSON: FeatureCollection,
	affiliations: Map<string, Affiliation>,
	cotMessages: string[]
): void {
	let features: Feature[] = [];
	if (deviceGeoJSON) {
		features = deviceGeoJSON.features.map((f) => {
			const props = f.properties || {};
			const mac = (props.mac || '').toUpperCase();
			const affiliation = affiliations.get(mac) || 'unknown';
			return {
				...f,
				properties: {
					...props,
					sidc: SymbolFactory.getSidcForDevice(props.type || 'unknown', affiliation),
					label: props.ssid || props.mac || 'Unknown'
				}
			};
		});
	}
	if (cotMessages.length > 0)
		features = [
			...features,
			...(cotMessages
				.map((xml) => parseCotToFeature(xml))
				.filter((f) => f !== null) as Feature[])
		];
	symbolLayer.update(features);
}

// ── Cell tower fetch ──

export interface CellTowerFetchState {
	lastLat: number;
	lastLon: number;
}

export async function maybeFetchCellTowers(
	lat: number,
	lon: number,
	state: CellTowerFetchState
): Promise<FeatureCollection | null> {
	if (lat === 0 && lon === 0) return null;
	const shouldFetch =
		(state.lastLat === 0 && state.lastLon === 0) ||
		haversineKm(lat, lon, state.lastLat, state.lastLon) > 1;
	if (!shouldFetch) return null;
	const result = await fetchCellTowers(lat, lon);
	if (result) {
		state.lastLat = lat;
		state.lastLon = lon;
	}
	return result;
}

// ── Range bands builder ──

export function buildRangeBands(): RangeBand[] {
	return [
		{
			outerR: 25,
			innerR: 0,
			band: 'vstrong',
			color: resolveMapColor(SIGNAL_COLORS.critical),
			rssi: '> -50',
			label: '25m'
		},
		{
			outerR: 60,
			innerR: 25,
			band: 'strong',
			color: resolveMapColor(SIGNAL_COLORS.strong),
			rssi: '-50 to -60',
			label: '60m'
		},
		{
			outerR: 100,
			innerR: 60,
			band: 'good',
			color: resolveMapColor(SIGNAL_COLORS.good),
			rssi: '-60 to -70',
			label: '100m'
		},
		{
			outerR: 175,
			innerR: 100,
			band: 'fair',
			color: resolveMapColor(SIGNAL_COLORS.fair),
			rssi: '-70 to -80',
			label: '175m'
		},
		{
			outerR: 300,
			innerR: 175,
			band: 'weak',
			color: resolveMapColor(SIGNAL_COLORS.weak),
			rssi: '< -80',
			label: '300m'
		}
	];
}
