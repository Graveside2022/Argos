// Kismet proxy device transformation helpers
//
// Extracted from KismetProxy to keep the main proxy file within the
// 300-line constitutional limit. Handles raw Kismet API response
// transformation into the internal KismetDevice format.

import type { KismetDevice } from './types';

/** Kismet API raw device response shape */
export interface KismetDeviceResponse {
	'kismet.device.base.macaddr'?: string;
	'kismet.device.base.name'?: string;
	'kismet.device.base.type'?: string;
	'kismet.device.base.channel'?: number;
	'kismet.device.base.frequency'?: number;
	'kismet.device.base.signal'?: number;
	'kismet.device.base.first_time'?: number;
	'kismet.device.base.last_time'?: number;
	'kismet.device.base.packets.total'?: number;
	'kismet.device.base.packets.data'?: number;
	'kismet.device.base.crypt'?: number;
	'kismet.device.base.location'?: {
		lat?: number;
		lon?: number;
		alt?: number;
	};
	'kismet.device.base.manuf'?: string;
}

/** Prefix stripping rules for Kismet device types */
const DEVICE_TYPE_PREFIXES: [string, string][] = [
	['Wi-Fi ', ''],
	['Bluetooth ', ''],
	['BTLE ', 'BLE '],
	['RTL433 ', ''],
	['UAV ', 'UAV ']
];

function stripDevicePrefix(kismetType: string): string {
	for (const [prefix, replacement] of DEVICE_TYPE_PREFIXES) {
		if (kismetType.startsWith(prefix)) {
			return replacement + kismetType.slice(prefix.length);
		}
	}
	return kismetType;
}

/**
 * Map Kismet device type to display label.
 * Passes through ALL types Kismet reports — strips common prefixes for cleaner display.
 */
export function mapDeviceType(kismetType: string | undefined): KismetDevice['type'] {
	if (!kismetType) return 'Unknown';
	return stripDevicePrefix(kismetType);
}

/** Encryption keyword patterns for string parsing */
const ENCRYPTION_KEYWORDS: [RegExp, string][] = [
	[/wpa3|sae/i, 'WPA3'],
	[/wpa2/i, 'WPA2'],
	[/wpa/i, 'WPA'],
	[/wep/i, 'WEP'],
	[/owe/i, 'OWE']
];

/** Bit flag positions for numeric encryption values */
const ENCRYPTION_FLAGS: [number, string][] = [
	[1, 'WEP'],
	[2, 'WPA'],
	[4, 'WPA2'],
	[8, 'WPA3'],
	[16, 'WPS']
];

/** Match a single encryption token against known patterns */
function matchEncryptionToken(token: string): string | null {
	for (const [regex, label] of ENCRYPTION_KEYWORDS) {
		if (regex.test(token)) return label;
	}
	return null;
}

function parseEncryptionString(value: string): string[] {
	const parts = value.split(/\s+/).filter((p) => p.length > 0);
	if (parts.length === 0) return ['Open'];
	const primary = new Set<string>();
	for (const p of parts) {
		const label = matchEncryptionToken(p);
		if (label) primary.add(label);
	}
	return primary.size > 0 ? Array.from(primary) : parts;
}

function parseEncryptionFlags(value: number): string[] {
	const types = ENCRYPTION_FLAGS.filter(([bit]) => value & bit).map(([, label]) => label);
	return types.length > 0 ? types : ['Open'];
}

/** Parse encryption number/string to array of encryption types */
export function parseEncryptionNumber(encryptionValue: number | string | undefined): string[] {
	if (!encryptionValue) return ['Open'];
	if (typeof encryptionValue === 'string') return parseEncryptionString(encryptionValue);
	return parseEncryptionFlags(encryptionValue);
}

/** Resolve a coordinate value from short or long key names */
function resolveCoord(location: Record<string, number>, short: string, long: string): number {
	return location[short] || location[long] || 0;
}

function parseLocationObject(location: Record<string, number>): KismetDevice['location'] {
	return {
		latitude: resolveCoord(location, 'lat', 'kismet.common.location.lat'),
		longitude: resolveCoord(location, 'lon', 'kismet.common.location.lon'),
		accuracy: location.accuracy || 0
	};
}

/** Extract location data from raw device */
export function extractLocationFromRaw(
	raw: KismetDeviceResponse
): KismetDevice['location'] | undefined {
	const location = raw['kismet.device.base.location'] as
		| Record<string, number>
		| number
		| undefined;

	if (!location || location === 0) return undefined;
	if (typeof location !== 'object') return undefined;
	return parseLocationObject(location);
}

/** Convert Kismet timestamp (seconds) to milliseconds */
export function convertTimestamp(timestamp: number | undefined): number {
	if (!timestamp || timestamp === 0) return Date.now();
	return timestamp * 1000;
}

/** Build uniform signal from scalar dBm */
function scalarSignal(dbm: number): { last: number; max: number; min: number } {
	return { last: dbm, max: dbm, min: dbm };
}

/** Extract signal from a Kismet signal object */
function objectSignal(obj: Record<string, number>): { last: number; max: number; min: number } {
	const last = obj['kismet.common.signal.last_signal'] ?? -100;
	return {
		last,
		max: obj['kismet.common.signal.max_signal'] ?? last,
		min: obj['kismet.common.signal.min_signal'] ?? last
	};
}

/** Extract signal data from raw device */
function extractSignal(raw: KismetDeviceResponse): { last: number; max: number; min: number } {
	// @constitutional-exemption Article-II-2.1 issue:#14 — Kismet REST API dynamic field access
	const signalRaw = raw['kismet.device.base.signal'] as
		| number
		| Record<string, number>
		| undefined;

	if (typeof signalRaw === 'number') return scalarSignal(signalRaw);
	if (signalRaw) return objectSignal(signalRaw);
	return scalarSignal(-100);
}

/** Extract dot11 client list from raw device */
function extractClients(dot11: Record<string, unknown>): string[] | undefined {
	const clientMap = dot11['dot11.device.associated_client_map'];
	if (!clientMap || typeof clientMap !== 'object') return undefined;
	// Safe: clientMap confirmed as object via typeof check
	const keys = Object.keys(clientMap as Record<string, unknown>);
	return keys.length > 0 ? keys : undefined;
}

/** Extract parent AP BSSID from dot11 data */
function extractParentAP(dot11: Record<string, unknown>, mac: string): string | undefined {
	const bssid = dot11['dot11.device.last_bssid'] as string | undefined;
	if (!bssid || bssid === '00:00:00:00:00:00' || bssid === mac) return undefined;
	return bssid;
}

/** Extract dot11 association data (clients + parent AP) */
function extractDot11(
	raw: KismetDeviceResponse,
	mac: string
): { clients?: string[]; parentAP?: string } {
	// Safe: Kismet raw device JSON objects use dotted key names; cast for dynamic access
	const dot11 = (raw as Record<string, unknown>)['dot11.device'] as
		| Record<string, unknown>
		| undefined;
	if (!dot11 || typeof dot11 !== 'object') return {};
	return { clients: extractClients(dot11), parentAP: extractParentAP(dot11, mac) };
}

/** Extract identity fields from a raw Kismet device */
function extractDeviceIdentity(
	raw: KismetDeviceResponse
): Pick<KismetDevice, 'mac' | 'macaddr' | 'ssid' | 'manufacturer' | 'type'> {
	const mac = raw['kismet.device.base.macaddr'] || 'Unknown';
	return {
		mac,
		macaddr: mac,
		ssid: raw['kismet.device.base.name'] || undefined,
		manufacturer: raw['kismet.device.base.manuf'] || 'Unknown',
		type: mapDeviceType(raw['kismet.device.base.type'])
	};
}

/** Extract metric fields from a raw Kismet device */
function extractDeviceMetrics(
	raw: KismetDeviceResponse
): Pick<KismetDevice, 'channel' | 'frequency' | 'packets' | 'dataSize'> {
	return {
		channel: (raw['kismet.device.base.channel'] as unknown as number) || 0,
		frequency: raw['kismet.device.base.frequency'] || 0,
		packets: raw['kismet.device.base.packets.total'] || 0,
		dataSize: raw['kismet.device.base.packets.data'] || 0
	};
}

/** Transform raw Kismet device data to our format */
export function transformDevice(raw: KismetDeviceResponse): KismetDevice {
	const identity = extractDeviceIdentity(raw);
	const signal = extractSignal(raw);
	const encryption = parseEncryptionNumber(raw['kismet.device.base.crypt']);
	const { clients, parentAP } = extractDot11(raw, identity.mac);

	return {
		...identity,
		...extractDeviceMetrics(raw),
		signal: { last_signal: signal.last, max_signal: signal.max, min_signal: signal.min },
		signalStrength: signal.last,
		firstSeen: convertTimestamp(raw['kismet.device.base.first_time']),
		lastSeen: convertTimestamp(raw['kismet.device.base.last_time']),
		encryptionType: encryption,
		encryption,
		location: extractLocationFromRaw(raw),
		clients,
		parentAP
	};
}
