/**
 * Pure helpers for map-handlers.ts — feature querying, popup content building,
 * and safe map layer operations.
 */
import maplibregl from 'maplibre-gl';

import type { Affiliation } from '$lib/stores/tactical-map/kismet-store';

import { resolveMapColor, SIGNAL_COLORS } from './map-colors';
import type { RangeBand } from './map-geojson';
import type { PopupState, TowerPopupState } from './map-handler-types';

export interface ClickResult {
	coordinates: [number, number];
	props: Record<string, unknown>;
}

export function queryClickFeature(
	map: maplibregl.Map,
	ev: maplibregl.MapMouseEvent,
	layerCandidates: string[]
): ClickResult | null {
	const layers = layerCandidates.filter((l) => map.getLayer(l));
	const features = map.queryRenderedFeatures(ev.point, { layers });
	if (!features?.length) return null;
	const geom = features[0].geometry;
	if (geom.type !== 'Point') return null;
	return {
		coordinates: geom.coordinates as [number, number],
		props: features[0].properties || {}
	};
}

function propStr(props: Record<string, unknown>, key: string, fallback: string): string {
	return (props[key] as string) ?? fallback;
}

function propNum(props: Record<string, unknown>, key: string, fallback: number): number {
	return (props[key] as number) ?? fallback;
}

export function buildDevicePopupContent(
	props: Record<string, unknown>,
	affiliations: Map<string, Affiliation>
): PopupState {
	const mac = propStr(props, 'mac', '');
	return {
		ssid: propStr(props, 'ssid', 'Unknown'),
		mac,
		rssi: propNum(props, 'rssi', -80),
		type: propStr(props, 'type', 'unknown'),
		manufacturer: propStr(props, 'manufacturer', 'Unknown'),
		channel: propNum(props, 'channel', 0),
		frequency: propNum(props, 'frequency', 0),
		packets: propNum(props, 'packets', 0),
		last_seen: propNum(props, 'last_seen', 0),
		clientCount: propNum(props, 'clientCount', 0),
		parentAP: propStr(props, 'parentAP', ''),
		affiliation: affiliations.get(mac.toUpperCase()) || 'unknown'
	};
}

export function buildTowerPopupContent(props: Record<string, unknown>): TowerPopupState {
	return {
		radio: propStr(props, 'radio', 'Unknown'),
		mcc: propNum(props, 'mcc', 0),
		mnc: propNum(props, 'mnc', 0),
		lac: propNum(props, 'lac', 0),
		ci: propNum(props, 'ci', 0),
		range: propNum(props, 'range', 0),
		samples: propNum(props, 'samples', 0),
		avgSignal: propNum(props, 'avgSignal', 0)
	};
}

export async function resolveClusterZoom(
	map: maplibregl.Map,
	clusterId: unknown
): Promise<number | null> {
	const source = map.getSource('devices-src') as maplibregl.GeoJSONSource;
	if (!source) return null;
	try {
		return await source.getClusterExpansionZoom(clusterId as number);
	} catch {
		return null;
	}
}

export function setLayerVisibility(map: maplibregl.Map, layerId: string, visible: boolean): void {
	if (map.getLayer(layerId)) {
		map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
	}
}

export function setLayerPaint(
	map: maplibregl.Map,
	layerId: string,
	prop: string,
	value: string
): void {
	if (map.getLayer(layerId)) {
		map.setPaintProperty(layerId, prop, value);
	}
}

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
