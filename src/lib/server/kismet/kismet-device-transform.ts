// Kismet raw device data transformation utilities
//
// Extracts transformation logic from WebSocketManager for reuse and to keep
// the main manager file within the 300-line constitutional limit.

import type { KismetDevice } from './types';

/** Kismet API raw device data interface */
export interface KismetRawDevice {
	'kismet.device.base.key': string;
	'kismet.device.base.macaddr': string;
	'kismet.device.base.name'?: string;
	'kismet.device.base.manuf'?: string;
	'kismet.device.base.type'?: string;
	'kismet.device.base.channel'?: number;
	'kismet.device.base.frequency'?: number;
	'kismet.device.base.signal'?: {
		'kismet.common.signal.last_signal'?: number;
	};
	'kismet.device.base.last_time'?: number;
	'kismet.device.base.first_time'?: number;
	'kismet.device.base.packets.total'?: number;
	'kismet.device.base.packets.data'?: number;
	'kismet.device.base.datasize'?: number;
	'kismet.device.base.crypt'?: Record<string, boolean>;
	'kismet.device.base.location'?: {
		'kismet.common.location.lat'?: number;
		'kismet.common.location.lon'?: number;
		'kismet.common.location.alt'?: number;
	};
}

/** Determine device type from Kismet data */
export function getDeviceType(device: KismetRawDevice): 'AP' | 'Client' | 'Bridge' | 'Unknown' {
	const type = device['kismet.device.base.type'];
	if (type === 'Wi-Fi AP') return 'AP';
	if (type === 'Wi-Fi Client') return 'Client';
	if (type === 'Wi-Fi Bridge') return 'Bridge';
	return 'Unknown';
}

/** Extract encryption types from Kismet device data */
export function getEncryptionTypes(device: KismetRawDevice): string[] {
	const crypt = device['kismet.device.base.crypt'];
	const types: string[] = [];

	if (!crypt) return types;

	if (crypt['Open']) types.push('Open');
	if (crypt['WEP']) types.push('WEP');
	if (crypt['WPA']) types.push('WPA');
	if (crypt['WPA2']) types.push('WPA2');
	if (crypt['WPA3']) types.push('WPA3');

	return types;
}

/** Extract device location from Kismet data */
export function getDeviceLocation(device: KismetRawDevice): KismetDevice['location'] | undefined {
	const location = device['kismet.device.base.location'];
	if (!location) return undefined;

	const lat = location['kismet.common.location.lat'];
	const lon = location['kismet.common.location.lon'];

	if (typeof lat !== 'number' || typeof lon !== 'number') {
		return undefined;
	}

	return {
		latitude: lat,
		longitude: lon,
		accuracy: location['kismet.common.location.alt'] || 0
	};
}

/** Check if device has changed compared to a previous snapshot */
export function hasDeviceChanged(oldDevice: KismetDevice, newDevice: KismetDevice): boolean {
	return (
		oldDevice.signalStrength !== newDevice.signalStrength ||
		oldDevice.channel !== newDevice.channel ||
		oldDevice.packets !== newDevice.packets ||
		oldDevice.ssid !== newDevice.ssid ||
		oldDevice.lastSeen !== newDevice.lastSeen
	);
}

/** Transform a raw Kismet device into a KismetDevice */
export function transformRawDevice(kismetDevice: KismetRawDevice): KismetDevice | null {
	const deviceKey = kismetDevice['kismet.device.base.key'];
	const macAddr = kismetDevice['kismet.device.base.macaddr'];

	if (!deviceKey || !macAddr) return null;

	const signalStrength =
		kismetDevice['kismet.device.base.signal']?.['kismet.common.signal.last_signal'] || 0;

	return {
		mac: macAddr,
		ssid: kismetDevice['kismet.device.base.name'] || '',
		manufacturer: kismetDevice['kismet.device.base.manuf'] || 'Unknown',
		type: getDeviceType(kismetDevice),
		channel: kismetDevice['kismet.device.base.channel'] || 0,
		frequency: kismetDevice['kismet.device.base.frequency'] || 0,
		signal: {
			last_signal: signalStrength,
			max_signal: signalStrength,
			min_signal: signalStrength
		},
		signalStrength: signalStrength,
		lastSeen: kismetDevice['kismet.device.base.last_time'] || Date.now() / 1000,
		firstSeen: kismetDevice['kismet.device.base.first_time'] || Date.now() / 1000,
		packets: kismetDevice['kismet.device.base.packets.total'] || 0,
		dataSize: kismetDevice['kismet.device.base.datasize'] || 0,
		dataPackets: kismetDevice['kismet.device.base.packets.data'] || 0,
		encryptionType: getEncryptionTypes(kismetDevice),
		encryption: getEncryptionTypes(kismetDevice),
		location: getDeviceLocation(kismetDevice),
		macaddr: macAddr // Alias for mac
	};
}
