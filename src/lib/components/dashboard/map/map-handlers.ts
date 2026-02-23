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

import type { SymbolLayer } from '$lib/map/layers/symbol-layer';
import { SymbolFactory } from '$lib/map/symbols/symbol-factory';
import type { Affiliation } from '$lib/stores/tactical-map/kismet-store';
import { parseCotToFeature } from '$lib/utils/cot-parser';

import { MAP_UI_COLORS, resolveMapColor } from './map-colors';
import type { PopupState, TowerPopupState } from './map-handler-types';
import {
	buildDevicePopupContent,
	buildTowerPopupContent,
	queryClickFeature,
	resolveClusterZoom,
	setLayerPaint,
	setLayerVisibility
} from './map-handlers-helpers';
import { fetchCellTowers, haversineKm, LAYER_MAP } from './map-helpers';

// Re-export types for backward compatibility
export type { PopupState, TowerPopupState } from './map-handler-types';

export function handleDeviceClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent,
	affiliations: Map<string, Affiliation>
): { lngLat: LngLatLike; content: PopupState } | null {
	const result = queryClickFeature(map, ev, ['device-circles', 'mil-sym-layer']);
	if (!result) return null;
	return {
		lngLat: result.coordinates,
		content: buildDevicePopupContent(result.props, affiliations)
	};
}

// ── Cluster click handler ──

export async function handleClusterClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent
): Promise<void> {
	const result = queryClickFeature(map, ev, ['device-clusters']);
	if (!result) return;
	const clusterId = result.props?.cluster_id;
	if (clusterId === undefined) return;
	const zoom = await resolveClusterZoom(map, clusterId);
	if (zoom !== null) {
		map.easeTo({ center: result.coordinates, zoom: Math.min(zoom, 18) });
	}
}

// ── Tower click handler ──

export function handleTowerClick(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent
): { lngLat: LngLatLike; content: TowerPopupState } | null {
	const result = queryClickFeature(map, ev, ['cell-tower-circles']);
	if (!result) return null;
	return {
		lngLat: result.coordinates,
		content: buildTowerPopupContent(result.props)
	};
}

// ── Layer visibility sync ──

function resolveLayerVis(
	key: string,
	vis: Record<string, boolean>,
	isoMac: string | null
): boolean {
	if (key === 'connectionLines') return vis[key] !== false || isoMac !== null;
	return vis[key] !== false;
}

export function syncLayerVisibility(
	map: maplibregl.Map,
	vis: Record<string, boolean>,
	isoMac: string | null,
	symbolLayer?: SymbolLayer
): void {
	if (symbolLayer) symbolLayer.setVisible(vis.milSyms !== false);
	for (const [key, layerIds] of Object.entries(LAYER_MAP)) {
		const visible = resolveLayerVis(key, vis, isoMac);
		for (const id of layerIds) setLayerVisibility(map, id, visible);
	}
}

// ── Cluster visibility sync ──

export function syncClusterVisibility(
	map: maplibregl.Map,
	isoMac: string | null,
	dotsVisible: boolean
): void {
	const vis = !isoMac && dotsVisible ? 'visible' : 'none';
	setLayerVisibility(map, 'device-clusters', vis === 'visible');
	setLayerVisibility(map, 'device-cluster-count', vis === 'visible');
}

// ── Theme paint sync ──

function applyClusterPaint(map: maplibregl.Map): void {
	const secondary = resolveMapColor(MAP_UI_COLORS.secondary);
	const border = resolveMapColor(MAP_UI_COLORS.border);
	const fg = resolveMapColor(MAP_UI_COLORS.foreground);
	setLayerPaint(map, 'device-clusters', 'circle-color', secondary);
	setLayerPaint(map, 'device-clusters', 'circle-stroke-color', border);
	setLayerPaint(map, 'device-cluster-count', 'text-color', fg);
}

function applyLabelPaint(map: maplibregl.Map): void {
	const mutedFg = resolveMapColor(MAP_UI_COLORS.mutedForeground);
	const bg = resolveMapColor(MAP_UI_COLORS.background);
	const fg = resolveMapColor(MAP_UI_COLORS.foreground);
	setLayerPaint(map, 'cell-tower-labels', 'text-color', mutedFg);
	setLayerPaint(map, 'cell-tower-labels', 'text-halo-color', bg);
	setLayerPaint(map, 'housenumber-labels', 'text-color', mutedFg);
	setLayerPaint(map, 'housenumber-labels', 'text-halo-color', bg);
	setLayerPaint(map, 'poi-labels-all', 'text-color', fg);
	setLayerPaint(map, 'poi-labels-all', 'text-halo-color', bg);
}

function applyBuildingPaint(map: maplibregl.Map): void {
	const border = resolveMapColor(MAP_UI_COLORS.border);
	setLayerPaint(map, 'building-outline-enhanced', 'line-color', `${border}4D`);
}

export function syncThemePaint(map: maplibregl.Map): void {
	applyClusterPaint(map);
	applyLabelPaint(map);
	applyBuildingPaint(map);
}

// ── Symbol layer update ──

let _prevDeviceCount = -1;
let _prevAffiliationSize = -1;
let _prevCotCount = -1;
let _prevDeviceFeatures: FeatureCollection | null = null;

function hasSymbolInputChanged(
	devCount: number,
	affSize: number,
	cotCount: number,
	deviceGeoJSON: FeatureCollection
): boolean {
	if (
		devCount === _prevDeviceCount &&
		affSize === _prevAffiliationSize &&
		cotCount === _prevCotCount &&
		deviceGeoJSON === _prevDeviceFeatures
	) {
		return false;
	}
	_prevDeviceCount = devCount;
	_prevAffiliationSize = affSize;
	_prevCotCount = cotCount;
	_prevDeviceFeatures = deviceGeoJSON;
	return true;
}

function resolveAffiliation(
	props: Record<string, unknown>,
	affiliations: Map<string, Affiliation>
): Affiliation {
	const mac = ((props.mac as string) || '').toUpperCase();
	return affiliations.get(mac) || 'unknown';
}

function buildSymbolLabel(props: Record<string, unknown>): string {
	return (props.ssid as string) || (props.mac as string) || 'Unknown';
}

function mapDeviceToSymbol(f: Feature, affiliations: Map<string, Affiliation>): Feature {
	const props = f.properties || {};
	const affiliation = resolveAffiliation(props, affiliations);
	return {
		...f,
		properties: {
			...props,
			sidc: SymbolFactory.getSidcForDevice((props.type as string) || 'unknown', affiliation),
			label: buildSymbolLabel(props)
		}
	};
}

function parseCotFeatures(cotMessages: string[]): Feature[] {
	if (!cotMessages.length) return [];
	return cotMessages.map((xml) => parseCotToFeature(xml)).filter((f): f is Feature => f !== null);
}

export function updateSymbolLayer(
	symbolLayer: SymbolLayer,
	deviceGeoJSON: FeatureCollection,
	affiliations: Map<string, Affiliation>,
	cotMessages: string[]
): void {
	const devCount = deviceGeoJSON?.features.length ?? 0;
	if (!hasSymbolInputChanged(devCount, affiliations.size, cotMessages.length, deviceGeoJSON)) {
		return;
	}
	const deviceFeatures = deviceGeoJSON
		? deviceGeoJSON.features.map((f) => mapDeviceToSymbol(f, affiliations))
		: [];
	const cotFeatures = parseCotFeatures(cotMessages);
	symbolLayer.update([...deviceFeatures, ...cotFeatures]);
}

// ── Cell tower fetch ──

export interface CellTowerFetchState {
	lastLat: number;
	lastLon: number;
}

function shouldFetchTowers(lat: number, lon: number, state: CellTowerFetchState): boolean {
	if (lat === 0 && lon === 0) return false;
	if (state.lastLat === 0 && state.lastLon === 0) return true;
	return haversineKm(lat, lon, state.lastLat, state.lastLon) > 1;
}

export async function maybeFetchCellTowers(
	lat: number,
	lon: number,
	state: CellTowerFetchState
): Promise<FeatureCollection | null> {
	if (!shouldFetchTowers(lat, lon, state)) return null;
	const result = await fetchCellTowers(lat, lon);
	if (result) {
		state.lastLat = lat;
		state.lastLon = lon;
	}
	return result;
}

// ── Range bands builder (re-export from helpers) ──
export { buildRangeBands } from './map-handlers-helpers';
