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

/** Encryption keys to check in Kismet device crypt data */
const CRYPT_KEYS = ['Open', 'WEP', 'WPA', 'WPA2', 'WPA3'] as const;

/** Extract encryption types from Kismet device data */
export function getEncryptionTypes(device: KismetRawDevice): string[] {
	const crypt = device['kismet.device.base.crypt'];
	if (!crypt) return [];
	return CRYPT_KEYS.filter((key) => crypt[key]);
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

/** Extract signal strength from raw device */
function getRawSignalStrength(device: KismetRawDevice): number {
	return device['kismet.device.base.signal']?.['kismet.common.signal.last_signal'] || 0;
}

/** Extract identity fields from raw Kismet device */
function buildDeviceIdentity(
	macAddr: string,
	kismetDevice: KismetRawDevice
): Pick<KismetDevice, 'mac' | 'macaddr' | 'ssid' | 'manufacturer' | 'type'> {
	return {
		mac: macAddr,
		macaddr: macAddr,
		ssid: kismetDevice['kismet.device.base.name'] || '',
		manufacturer: kismetDevice['kismet.device.base.manuf'] || 'Unknown',
		type: getDeviceType(kismetDevice)
	};
}

/** Extract radio metrics from raw Kismet device */
function buildRadioMetrics(
	kismetDevice: KismetRawDevice
): Pick<KismetDevice, 'channel' | 'frequency'> {
	return {
		channel: kismetDevice['kismet.device.base.channel'] || 0,
		frequency: kismetDevice['kismet.device.base.frequency'] || 0
	};
}

/** Extract traffic metrics from raw Kismet device */
function buildDeviceMetrics(
	kismetDevice: KismetRawDevice
): Pick<KismetDevice, 'channel' | 'frequency' | 'packets' | 'dataSize' | 'dataPackets'> {
	return {
		...buildRadioMetrics(kismetDevice),
		packets: kismetDevice['kismet.device.base.packets.total'] || 0,
		dataSize: kismetDevice['kismet.device.base.datasize'] || 0,
		dataPackets: kismetDevice['kismet.device.base.packets.data'] || 0
	};
}

/** Extract time fields from raw Kismet device */
function buildDeviceTiming(
	kismetDevice: KismetRawDevice
): Pick<KismetDevice, 'lastSeen' | 'firstSeen'> {
	const now = Date.now() / 1000;
	return {
		lastSeen: kismetDevice['kismet.device.base.last_time'] || now,
		firstSeen: kismetDevice['kismet.device.base.first_time'] || now
	};
}

/** Build a KismetDevice from validated raw data */
function buildDevice(macAddr: string, kismetDevice: KismetRawDevice): KismetDevice {
	const signalStrength = getRawSignalStrength(kismetDevice);
	const encryption = getEncryptionTypes(kismetDevice);
	return {
		...buildDeviceIdentity(macAddr, kismetDevice),
		...buildDeviceMetrics(kismetDevice),
		...buildDeviceTiming(kismetDevice),
		signal: {
			last_signal: signalStrength,
			max_signal: signalStrength,
			min_signal: signalStrength
		},
		signalStrength,
		encryptionType: encryption,
		encryption,
		location: getDeviceLocation(kismetDevice)
	};
}

/** Transform a raw Kismet device into a KismetDevice */
export function transformRawDevice(kismetDevice: KismetRawDevice): KismetDevice | null {
	const macAddr = kismetDevice['kismet.device.base.macaddr'];
	if (!kismetDevice['kismet.device.base.key'] || !macAddr) return null;
	return buildDevice(macAddr, kismetDevice);
}
