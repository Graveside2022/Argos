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
	bezierArc,
	createCirclePolygon,
	createRingPolygon,
	spreadClientPosition
} from './map-helpers';

export interface RangeBand {
	outerR: number;
	innerR: number;
	band: string;
	color: string;
	rssi: string;
	label: string;
}

/** Build the GPS accuracy circle as a GeoJSON polygon. */
export function buildAccuracyGeoJSON(
	lat: number,
	lon: number,
	accuracy: number
): FeatureCollection {
	if ((lat === 0 && lon === 0) || accuracy <= 0) {
		return { type: 'FeatureCollection', features: [] };
	}
	return {
		type: 'FeatureCollection',
		features: [createCirclePolygon(lon, lat, accuracy)]
	};
}

/** Build concentric signal-detection range rings. */
export function buildDetectionRangeGeoJSON(
	lat: number,
	lon: number,
	rangeBands: RangeBand[]
): FeatureCollection {
	if (lat === 0 && lon === 0) return { type: 'FeatureCollection', features: [] };
	const features: Feature[] = [];
	for (const b of rangeBands) {
		features.push({
			...createRingPolygon(lon, lat, b.outerR, b.innerR),
			properties: { band: b.band, color: b.color }
		});
	}
	return { type: 'FeatureCollection', features };
}

/** Build point features for all visible devices with signal-band filtering. */
export function buildDeviceGeoJSON(
	state: KismetState,
	isolatedMAC: string | null,
	activeBands: Set<string>,
	visibilityMode: VisibilityMode,
	promotedDevices: Set<string>
): FeatureCollection {
	const features: Feature[] = [];

	let visibleMACs: Set<string> | null = null;
	if (isolatedMAC) {
		const ap = state.devices.get(isolatedMAC);
		visibleMACs = new Set([isolatedMAC]);
		if (ap?.clients?.length) for (const c of ap.clients) visibleMACs.add(c);
	}

	const devicesForVisibility: (DeviceForVisibility & { mac: string })[] = [];
	state.devices.forEach((device: KismetDevice, mac: string) => {
		if (visibleMACs && !visibleMACs.has(mac)) return;
		const lat = device.location?.lat;
		const lon = device.location?.lon;
		if (!lat || !lon || (lat === 0 && lon === 0)) return;
		devicesForVisibility.push({
			mac,
			rssi: device.signal?.last_signal ?? 0,
			lastSeen: device.last_seen || 0
		});
	});

	const visible = filterByVisibility(devicesForVisibility, visibilityMode, promotedDevices);
	const visibleMacSet = new Set(visible.map((d) => d.mac));

	state.devices.forEach((device: KismetDevice, mac: string) => {
		if (!visibleMacSet.has(mac)) return;
		let lat = device.location?.lat;
		let lon = device.location?.lon;
		if (!lat || !lon || (lat === 0 && lon === 0)) return;
		const rssi = device.signal?.last_signal ?? 0;
		const band = getSignalBandKey(rssi);
		if (!activeBands.has(band)) return;

		if (device.parentAP) {
			const ap = state.devices.get(device.parentAP);
			if (ap?.location?.lat && ap?.location?.lon) {
				const [sLon, sLat] = spreadClientPosition(
					lon,
					lat,
					ap.location.lon,
					ap.location.lat,
					mac,
					rssi
				);
				lon = sLon;
				lat = sLat;
			}
		}

		features.push({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [lon, lat] },
			properties: {
				mac,
				ssid: device.ssid || 'Unknown',
				rssi,
				band,
				type: device.type || 'unknown',
				color: getSignalHex(rssi),
				manufacturer: device.manufacturer || device.manuf || 'Unknown',
				channel: device.channel || 0,
				frequency: device.frequency || 0,
				packets: device.packets || 0,
				last_seen: device.last_seen || 0,
				clientCount: device.clients?.length ?? 0,
				parentAP: device.parentAP ?? ''
			}
		});
	});
	return { type: 'FeatureCollection', features };
}

/** Build bezier arcs connecting APs to their clients. */
export function buildConnectionLinesGeoJSON(
	state: KismetState,
	isolatedMAC: string | null,
	layerOn: boolean,
	visibleDeviceMACs: Set<string>
): FeatureCollection {
	if (!isolatedMAC && !layerOn) return { type: 'FeatureCollection', features: [] };

	const features: Feature[] = [];
	state.devices.forEach((device: KismetDevice) => {
		if (!device.clients?.length) return;
		if (isolatedMAC && device.mac !== isolatedMAC) return;
		const apLat = device.location?.lat;
		const apLon = device.location?.lon;
		if (!apLat || !apLon) return;
		const apColor = getSignalHex(device.signal?.last_signal ?? 0);
		for (const clientMac of device.clients) {
			if (!visibleDeviceMACs.has(clientMac)) continue;
			const client = state.devices.get(clientMac);
			if (!client?.location?.lat || !client?.location?.lon) continue;
			const [cLon, cLat] = spreadClientPosition(
				client.location.lon,
				client.location.lat,
				apLon,
				apLat,
				clientMac,
				client.signal?.last_signal ?? -70
			);
			features.push({
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: bezierArc([apLon, apLat], [cLon, cLat])
				},
				properties: { apMac: device.mac, clientMac, color: apColor }
			});
		}
	});
	return { type: 'FeatureCollection', features };
}
