/**
 * Pure helper functions for map-geojson.ts — device property builders,
 * coordinate resolution, and connection feature construction.
 */
import type { Feature } from 'geojson';

import type { KismetDevice } from '$lib/kismet/types';
import type { DeviceForVisibility } from '$lib/map/visibility-engine';
import type { KismetState } from '$lib/stores/tactical-map/kismet-store';
import { getSignalHex } from '$lib/utils/signal-utils';

import { bezierArc, spreadClientPosition } from './map-helpers';

function isOrigin(lat: number, lon: number): boolean {
	return lat === 0 && lon === 0;
}

function hasLocation(loc: KismetDevice['location']): loc is { lat: number; lon: number } {
	return !!loc?.lat && !!loc?.lon;
}

export function getCoords(device: KismetDevice): { lat: number; lon: number } | null {
	if (!hasLocation(device.location)) return null;
	if (isOrigin(device.location.lat, device.location.lon)) return null;
	return { lat: device.location.lat, lon: device.location.lon };
}

export { isOrigin };

export function isVisibleCandidate(
	mac: string,
	device: KismetDevice,
	visibleMACs: Set<string> | null
): boolean {
	if (visibleMACs && !visibleMACs.has(mac)) return false;
	return getCoords(device) !== null;
}

export function toCandidate(
	mac: string,
	device: KismetDevice
): DeviceForVisibility & { mac: string } {
	return {
		mac,
		rssi: device.signal?.last_signal ?? 0,
		lastSeen: device.last_seen || 0
	};
}

function getAPCoords(parentMAC: string, state: KismetState): { lat: number; lon: number } | null {
	const ap = state.devices.get(parentMAC);
	if (!ap) return null;
	return getCoords(ap);
}

export function resolveSpreadCoords(
	device: KismetDevice,
	lon: number,
	lat: number,
	mac: string,
	rssi: number,
	state: KismetState
): [number, number] {
	if (!device.parentAP) return [lon, lat];
	const apCoords = getAPCoords(device.parentAP, state);
	if (!apCoords) return [lon, lat];
	return spreadClientPosition(lon, lat, apCoords.lon, apCoords.lat, mac, rssi);
}

function deviceSSID(device: KismetDevice): string {
	return device.ssid || 'Unknown';
}

function deviceManuf(device: KismetDevice): string {
	return device.manufacturer || device.manuf || 'Unknown';
}

function buildDeviceIdentity(
	device: KismetDevice,
	mac: string,
	rssi: number,
	band: string
): Record<string, unknown> {
	return {
		mac,
		ssid: deviceSSID(device),
		rssi,
		band,
		type: device.type || 'unknown',
		color: getSignalHex(rssi),
		manufacturer: deviceManuf(device)
	};
}

function buildDeviceRadio(device: KismetDevice): Record<string, unknown> {
	return {
		channel: device.channel || 0,
		frequency: device.frequency || 0,
		packets: device.packets || 0,
		last_seen: device.last_seen || 0
	};
}

function buildDeviceRelations(device: KismetDevice): Record<string, unknown> {
	return {
		clientCount: device.clients?.length ?? 0,
		parentAP: device.parentAP ?? ''
	};
}

export function buildDeviceProperties(
	device: KismetDevice,
	mac: string,
	rssi: number,
	band: string
): Record<string, unknown> {
	return {
		...buildDeviceIdentity(device, mac, rssi, band),
		...buildDeviceRadio(device),
		...buildDeviceRelations(device)
	};
}

export function resolveClientCoords(
	client: KismetDevice,
	clientMac: string,
	apLon: number,
	apLat: number
): [number, number] | null {
	const coords = getCoords(client);
	if (!coords) return null;
	return spreadClientPosition(
		coords.lon,
		coords.lat,
		apLon,
		apLat,
		clientMac,
		client.signal?.last_signal ?? -70
	);
}

export function buildConnectionFeature(
	apMac: string,
	clientMac: string,
	apLon: number,
	apLat: number,
	apColor: string,
	clientCoords: [number, number]
): Feature {
	return {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: bezierArc([apLon, apLat], clientCoords)
		},
		properties: { apMac, clientMac, color: apColor }
	};
}

export function getDeviceRSSI(device: KismetDevice): number {
	return device.signal?.last_signal ?? 0;
}
