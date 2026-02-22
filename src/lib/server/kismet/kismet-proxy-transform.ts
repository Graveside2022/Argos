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

/**
 * Map Kismet device type to display label.
 * Passes through ALL types Kismet reports — strips common prefixes for cleaner display.
 */
export function mapDeviceType(kismetType: string | undefined): KismetDevice['type'] {
	if (!kismetType) return 'Unknown';
	if (kismetType.startsWith('Wi-Fi ')) return kismetType.slice(6);
	if (kismetType.startsWith('Bluetooth ')) return kismetType.slice(10);
	if (kismetType.startsWith('BTLE ')) return 'BLE ' + kismetType.slice(5);
	if (kismetType.startsWith('RTL433 ')) return kismetType.slice(7);
	if (kismetType.startsWith('UAV ')) return kismetType;
	return kismetType;
}

/** Parse encryption number/string to array of encryption types */
export function parseEncryptionNumber(encryptionValue: number | string | undefined): string[] {
	if (!encryptionValue) return ['Open'];

	// Kismet can return crypt as a string like "WPA2 WPA2-PSK AES-CCMP"
	if (typeof encryptionValue === 'string') {
		const parts = encryptionValue.split(/\s+/).filter((p) => p.length > 0);
		if (parts.length === 0) return ['Open'];
		const primary = new Set<string>();
		for (const p of parts) {
			if (/wpa3|sae/i.test(p)) primary.add('WPA3');
			else if (/wpa2/i.test(p)) primary.add('WPA2');
			else if (/wpa/i.test(p)) primary.add('WPA');
			else if (/wep/i.test(p)) primary.add('WEP');
			else if (/owe/i.test(p)) primary.add('OWE');
		}
		return primary.size > 0 ? Array.from(primary) : parts;
	}

	if (encryptionValue === 0) return ['Open'];

	// Fallback: treat as bit flags
	const encryptionTypes: string[] = [];
	if (encryptionValue & 1) encryptionTypes.push('WEP');
	if (encryptionValue & 2) encryptionTypes.push('WPA');
	if (encryptionValue & 4) encryptionTypes.push('WPA2');
	if (encryptionValue & 8) encryptionTypes.push('WPA3');
	if (encryptionValue & 16) encryptionTypes.push('WPS');

	return encryptionTypes.length > 0 ? encryptionTypes : ['Open'];
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

	if (typeof location === 'object') {
		return {
			latitude: location.lat || location['kismet.common.location.lat'] || 0,
			longitude: location.lon || location['kismet.common.location.lon'] || 0,
			accuracy: location.accuracy || 0
		};
	}

	return undefined;
}

/** Convert Kismet timestamp (seconds) to milliseconds */
export function convertTimestamp(timestamp: number | undefined): number {
	if (!timestamp || timestamp === 0) return Date.now();
	return timestamp * 1000;
}

/** Transform raw Kismet device data to our format */
export function transformDevice(raw: KismetDeviceResponse): KismetDevice {
	const type = mapDeviceType(raw['kismet.device.base.type']);
	const encryptionNumber = raw['kismet.device.base.crypt'];
	const manufacturer = raw['kismet.device.base.manuf'] || 'Unknown';
	// @constitutional-exemption Article-II-2.1 issue:#14 — Kismet REST API dynamic field access — external API returns untyped data
	const signalRaw = raw['kismet.device.base.signal'] as
		| number
		| Record<string, number>
		| undefined;

	const lastSignal =
		typeof signalRaw === 'number'
			? signalRaw
			: (signalRaw?.['kismet.common.signal.last_signal'] ?? -100);
	const maxSignal =
		typeof signalRaw === 'object' && signalRaw
			? (signalRaw['kismet.common.signal.max_signal'] ?? lastSignal)
			: lastSignal;
	const minSignal =
		typeof signalRaw === 'object' && signalRaw
			? (signalRaw['kismet.common.signal.min_signal'] ?? lastSignal)
			: lastSignal;

	// Extract dot11 association data
	// Safe: Kismet raw device JSON objects use dotted key names; cast for dynamic access
	const dot11 = (raw as Record<string, unknown>)['dot11.device'] as
		| Record<string, unknown>
		| undefined;
	const mac = raw['kismet.device.base.macaddr'] || 'Unknown';
	let clients: string[] | undefined;
	let parentAP: string | undefined;

	if (dot11 && typeof dot11 === 'object') {
		const clientMap = dot11['dot11.device.associated_client_map'];
		if (clientMap && typeof clientMap === 'object') {
			// Safe: clientMap confirmed as object via typeof check
			clients = Object.keys(clientMap as Record<string, unknown>);
			if (clients.length === 0) clients = undefined;
		}

		const bssid = dot11['dot11.device.last_bssid'] as string | undefined;
		if (bssid && bssid !== '00:00:00:00:00:00' && bssid !== mac) {
			parentAP = bssid;
		}
	}

	return {
		mac,
		macaddr: mac,
		ssid: raw['kismet.device.base.name'] || undefined,
		manufacturer,
		type,
		channel: (raw['kismet.device.base.channel'] as unknown as number) || 0,
		frequency: raw['kismet.device.base.frequency'] || 0,
		signal: { last_signal: lastSignal, max_signal: maxSignal, min_signal: minSignal },
		signalStrength: lastSignal,
		firstSeen: convertTimestamp(raw['kismet.device.base.first_time']),
		lastSeen: convertTimestamp(raw['kismet.device.base.last_time']),
		packets: raw['kismet.device.base.packets.total'] || 0,
		dataSize: raw['kismet.device.base.packets.data'] || 0,
		encryptionType: parseEncryptionNumber(encryptionNumber),
		encryption: parseEncryptionNumber(encryptionNumber),
		location: extractLocationFromRaw(raw),
		clients,
		parentAP
	};
}
