/**
 * Kismet WebSocket message handlers — device, network, alert, GPS, and status processing.
 * Extracted from websocket.ts to comply with Article 2.2 (max 300 lines/file).
 */

import { get } from 'svelte/store';

import { kismetStore } from '$lib/kismet/stores';
import type {
	KismetAlert,
	KismetDevice,
	KismetGPS,
	KismetNetwork,
	KismetStatus
} from '$lib/kismet/types';
import { logger } from '$lib/utils/logger';

// ---------------------------------------------------------------------------
// Shared type-narrowing helpers
// ---------------------------------------------------------------------------

/** Narrow unknown to a record, returning null when not a non-null object. */
function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || value === null) return null;
	return value as Record<string, unknown>;
}

/** Return obj[field] when it is a string, or null. */
function requireStringField(obj: Record<string, unknown>, field: string): string | null {
	return field in obj && typeof obj[field] === 'string' ? (obj[field] as string) : null;
}

/** Return obj[field] when it is a boolean, or undefined. */
function extractBoolField(obj: Record<string, unknown>, field: string): boolean | undefined {
	const v = obj[field];
	return typeof v === 'boolean' ? v : undefined;
}

/** Return obj[field] as a string, or fallback when missing/wrong type. */
function gpsStr(obj: Record<string, unknown>, field: string, fallback: string): string {
	return typeof obj[field] === 'string' ? (obj[field] as string) : fallback;
}

// ---------------------------------------------------------------------------
// Array upsert helper
// ---------------------------------------------------------------------------

/** Find an item by keyField, merge-update if found, push if not. Returns new array. */
function upsertInArray<T extends object>(
	array: T[],
	keyField: keyof T,
	keyValue: unknown,
	newItem: T
): T[] {
	const result = [...array];
	const index = result.findIndex((item) => item[keyField] === keyValue);
	if (index >= 0) {
		result[index] = { ...result[index], ...newItem };
	} else {
		result.push(newItem);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Alert field extractors
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = new Set<KismetAlert['severity']>(['low', 'medium', 'high']);
const VALID_ALERT_TYPES = new Set<KismetAlert['type']>([
	'new_device',
	'security',
	'deauth',
	'probe',
	'handshake',
	'suspicious',
	'info'
]);

function extractMessage(obj: Record<string, unknown>): string {
	return requireStringField(obj, 'message') ?? 'Unknown alert';
}

function extractSeverity(obj: Record<string, unknown>): KismetAlert['severity'] {
	const raw = requireStringField(obj, 'severity');
	return raw !== null && VALID_SEVERITIES.has(raw as KismetAlert['severity'])
		? (raw as KismetAlert['severity'])
		: 'low';
}

function extractTimestamp(obj: Record<string, unknown>): number {
	return 'timestamp' in obj && typeof obj.timestamp === 'number'
		? obj.timestamp
		: Date.now() / 1000;
}

function extractAlertType(obj: Record<string, unknown>): KismetAlert['type'] {
	const raw = requireStringField(obj, 'type');
	return raw !== null && VALID_ALERT_TYPES.has(raw as KismetAlert['type'])
		? (raw as KismetAlert['type'])
		: 'info';
}

// ---------------------------------------------------------------------------
// Device name resolution
// ---------------------------------------------------------------------------

function resolveDeviceName(obj: Record<string, unknown>): string {
	const ssid = requireStringField(obj, 'last_ssid');
	return ssid ?? String(obj.mac);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Handle Kismet status updates */
export function handleStatusUpdate(status: unknown): void {
	const statusObj = asRecord(status);
	if (!statusObj) return;

	const partialStatus: Partial<KismetStatus> = {};

	const kismetRunning = extractBoolField(statusObj, 'kismet_running');
	if (kismetRunning !== undefined) partialStatus.kismet_running = kismetRunning;

	const wigleRunning = extractBoolField(statusObj, 'wigle_running');
	if (wigleRunning !== undefined) partialStatus.wigle_running = wigleRunning;

	const gpsRunning = extractBoolField(statusObj, 'gps_running');
	if (gpsRunning !== undefined) partialStatus.gps_running = gpsRunning;

	kismetStore.updateStatus(partialStatus);
}

/** Handle device update */
export function handleDeviceUpdate(device: unknown): void {
	const deviceObj = asRecord(device);
	if (!deviceObj) return;
	if (!requireStringField(deviceObj, 'mac')) return;

	const store = get(kismetStore);
	const kismetDevice = device as KismetDevice;
	const devices = upsertInArray(store.devices, 'mac', deviceObj.mac, kismetDevice);
	kismetStore.updateDevices(devices);
}

/** Handle new device detection */
export function handleNewDevice(device: unknown): void {
	const deviceObj = asRecord(device);
	if (!deviceObj) return;
	if (!requireStringField(deviceObj, 'mac')) return;

	const kismetDevice = device as KismetDevice;
	const store = get(kismetStore);
	kismetStore.updateDevices([...store.devices, kismetDevice]);

	kismetStore.addAlert({
		type: 'new_device',
		severity: 'low',
		message: `New device detected: ${resolveDeviceName(deviceObj)}`,
		timestamp: Date.now() / 1000
	});
}

/** Handle device removal */
export function handleDeviceRemoved(data: unknown): void {
	const dataObj = asRecord(data);
	if (!dataObj) return;

	const mac = requireStringField(dataObj, 'mac');
	if (!mac) return;

	const store = get(kismetStore);
	kismetStore.updateDevices(store.devices.filter((d) => d.mac !== mac));
}

/** Handle full devices list */
export function handleDevicesList(data: unknown): void {
	const dataObj = asRecord(data);
	if (!dataObj) return;
	if (!('devices' in dataObj) || !Array.isArray(dataObj.devices)) return;

	const devices = (dataObj.devices as unknown[]).filter(
		(d): d is KismetDevice => d !== null && typeof d === 'object' && 'mac' in d
	);
	kismetStore.updateDevices(devices);
}

/** Handle network update */
export function handleNetworkUpdate(network: unknown): void {
	const networkObj = asRecord(network);
	if (!networkObj) return;
	if (!requireStringField(networkObj, 'ssid')) return;

	const store = get(kismetStore);
	const kismetNetwork = network as KismetNetwork;
	const networks = upsertInArray(store.networks, 'ssid', networkObj.ssid, kismetNetwork);
	kismetStore.updateNetworks(networks);
}

/** Handle full networks list */
export function handleNetworksList(data: unknown): void {
	const dataObj = asRecord(data);
	if (!dataObj) return;
	if (!('networks' in dataObj) || !Array.isArray(dataObj.networks)) return;

	const networks = (dataObj.networks as unknown[]).filter(
		(n): n is KismetNetwork => n !== null && typeof n === 'object' && 'ssid' in n
	);
	kismetStore.updateNetworks(networks);
}

/** Handle alert messages */
export function handleAlert(alert: unknown): void {
	const alertObj = asRecord(alert);
	if (!alertObj) return;

	kismetStore.addAlert({
		type: extractAlertType(alertObj),
		severity: extractSeverity(alertObj),
		message: extractMessage(alertObj),
		timestamp: extractTimestamp(alertObj)
	});
}

/** Handle GPS position updates */
export function handleGpsUpdate(gps: unknown): void {
	const gpsObj = asRecord(gps);
	if (!gpsObj) return;

	const gpsData: KismetGPS = {
		status: gpsStr(gpsObj, 'status', 'No Fix'),
		lat: gpsStr(gpsObj, 'lat', 'N/A'),
		lon: gpsStr(gpsObj, 'lon', 'N/A'),
		alt: gpsStr(gpsObj, 'alt', 'N/A'),
		time: gpsStr(gpsObj, 'time', 'N/A')
	};

	kismetStore.updateGPS(gpsData);
}

/** Handle error messages */
export function handleErrorMessage(error: unknown): void {
	logger.error('[Kismet] Server error', { error });

	const errorObj = asRecord(error);
	const errorMessage = errorObj
		? (requireStringField(errorObj, 'message') ?? 'Unknown server error')
		: 'Unknown server error';

	kismetStore.addAlert({
		type: 'security',
		severity: 'high',
		message: errorMessage,
		timestamp: Date.now() / 1000
	});
}
