/**
 * GeoJSON feature builders for the dashboard map.
 *
 * Extracted from DashboardMap.svelte — these are pure functions that
 * transform Kismet device data + GPS state into GeoJSON FeatureCollections
 * consumed by MapLibre layers.
 */
import type { Feature, FeatureCollection } from 'geojson';

import type { KismetDevice } from '$lib/kismet/types';
import {
	type DeviceForVisibility,
	filterByVisibility,
	type VisibilityMode
} from '$lib/map/visibility-engine';
import type { KismetState } from '$lib/stores/tactical-map/kismet-store';
import { getSignalBandKey, getSignalHex } from '$lib/utils/signal-utils';

import {
	buildConnectionFeature,
	buildDeviceProperties,
	getCoords,
	getDeviceRSSI,
	isOrigin,
	isVisibleCandidate,
	resolveClientCoords,
	resolveSpreadCoords,
	toCandidate
} from './map-geojson-helpers';
import { createCirclePolygon, createRingPolygon } from './map-helpers';

/** Minimum fields needed by buildDetectionRangeGeoJSON */
export interface RangeBandCore {
	outerR: number;
	innerR: number;
	band: string;
	color: string;
}

export interface RangeBand extends RangeBandCore {
	rssi: string;
	label: string;
}

const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Build the GPS accuracy circle as a GeoJSON polygon. */
export function buildAccuracyGeoJSON(
	lat: number,
	lon: number,
	accuracy: number
): FeatureCollection {
	if (isOrigin(lat, lon) || accuracy <= 0) return EMPTY_COLLECTION;
	return {
		type: 'FeatureCollection',
		features: [createCirclePolygon(lon, lat, accuracy)]
	};
}

/** Build concentric signal-detection range rings. Accepts RangeBand or RFRangeBand. */
export function buildDetectionRangeGeoJSON(
	lat: number,
	lon: number,
	rangeBands: RangeBandCore[]
): FeatureCollection {
	if (isOrigin(lat, lon)) return EMPTY_COLLECTION;
	const features: Feature[] = [];
	for (const b of rangeBands) {
		features.push({
			...createRingPolygon(lon, lat, b.outerR, b.innerR),
			properties: { band: b.band, color: b.color }
		});
	}
	return { type: 'FeatureCollection', features };
}

function buildIsolatedMACSet(state: KismetState, isolatedMAC: string): Set<string> {
	const macs = new Set([isolatedMAC]);
	const ap = state.devices.get(isolatedMAC);
	if (ap?.clients?.length) {
		for (const c of ap.clients) macs.add(c);
	}
	return macs;
}

function collectVisibilityCandidates(
	state: KismetState,
	visibleMACs: Set<string> | null
): (DeviceForVisibility & { mac: string })[] {
	const candidates: (DeviceForVisibility & { mac: string })[] = [];
	state.devices.forEach((device: KismetDevice, mac: string) => {
		if (isVisibleCandidate(mac, device, visibleMACs)) {
			candidates.push(toCandidate(mac, device));
		}
	});
	return candidates;
}

function buildDeviceFeature(
	device: KismetDevice,
	mac: string,
	activeBands: Set<string>,
	state: KismetState
): Feature | null {
	const coords = getCoords(device);
	if (!coords) return null;
	const rssi = getDeviceRSSI(device);
	const band = getSignalBandKey(rssi);
	if (!activeBands.has(band)) return null;
	const [lon, lat] = resolveSpreadCoords(device, coords.lon, coords.lat, mac, rssi, state);
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [lon, lat] },
		properties: buildDeviceProperties(device, mac, rssi, band)
	};
}

/** Build point features for all visible devices with signal-band filtering. */
export function buildDeviceGeoJSON(
	state: KismetState,
	isolatedMAC: string | null,
	activeBands: Set<string>,
	visibilityMode: VisibilityMode,
	promotedDevices: Set<string>
): FeatureCollection {
	const visibleMACs = isolatedMAC ? buildIsolatedMACSet(state, isolatedMAC) : null;
	const candidates = collectVisibilityCandidates(state, visibleMACs);
	const visible = filterByVisibility(candidates, visibilityMode, promotedDevices);
	return buildVisibleFeatures(visible, activeBands, state);
}

function buildVisibleFeatures(
	visible: (DeviceForVisibility & { mac: string })[],
	activeBands: Set<string>,
	state: KismetState
): FeatureCollection {
	const features: Feature[] = [];
	for (const { mac } of visible) {
		const device = state.devices.get(mac);
		if (!device) continue;
		const feature = buildDeviceFeature(device, mac, activeBands, state);
		if (feature) features.push(feature);
	}
	return { type: 'FeatureCollection', features };
}

function buildClientArc(
	apMac: string,
	clientMac: string,
	apCoords: { lat: number; lon: number },
	apColor: string,
	state: KismetState
): Feature | null {
	const client = state.devices.get(clientMac);
	if (!client) return null;
	const cCoords = resolveClientCoords(client, clientMac, apCoords.lon, apCoords.lat);
	if (!cCoords) return null;
	return buildConnectionFeature(apMac, clientMac, apCoords.lon, apCoords.lat, apColor, cCoords);
}

function buildClientArcs(
	apMac: string,
	clients: string[],
	apCoords: { lat: number; lon: number },
	apColor: string,
	visibleDeviceMACs: Set<string>,
	state: KismetState
): Feature[] {
	const features: Feature[] = [];
	for (const clientMac of clients) {
		if (!visibleDeviceMACs.has(clientMac)) continue;
		const feature = buildClientArc(apMac, clientMac, apCoords, apColor, state);
		if (feature) features.push(feature);
	}
	return features;
}

function collectAPConnections(
	device: KismetDevice,
	visibleDeviceMACs: Set<string>,
	state: KismetState
): Feature[] {
	const coords = getCoords(device);
	if (!coords) return [];
	if (!device.clients?.length) return [];
	const apColor = getSignalHex(getDeviceRSSI(device));
	return buildClientArcs(device.mac, device.clients, coords, apColor, visibleDeviceMACs, state);
}

/** Build bezier arcs connecting APs to their clients. */
export function buildConnectionLinesGeoJSON(
	state: KismetState,
	isolatedMAC: string | null,
	layerOn: boolean,
	visibleDeviceMACs: Set<string>
): FeatureCollection {
	if (!isolatedMAC && !layerOn) return EMPTY_COLLECTION;

	const features: Feature[] = [];
	state.devices.forEach((device: KismetDevice) => {
		if (isolatedMAC && device.mac !== isolatedMAC) return;
		features.push(...collectAPConnections(device, visibleDeviceMACs, state));
	});
	return { type: 'FeatureCollection', features };
}
