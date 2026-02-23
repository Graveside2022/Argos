// Kismet device transform helpers for KismetService
//
// Converts validated Kismet device data (simplified and raw formats)
// into the unified KismetDevice interface used by the service layer.

import type { GPSPosition, KismetDevice } from './kismet.service';

const DEFAULT_SIGNAL = -100;

type LocationResolver = (
	lat: number | undefined,
	lon: number | undefined,
	gps: GPSPosition | null,
	mac: string,
	signal: number
) => { lat: number; lon: number };

/** Build a uniform signal block from a single dBm value */
function makeSignalBlock(dbm: number): KismetDevice['signal'] {
	return { last_signal: dbm, max_signal: dbm, min_signal: dbm };
}

/** Parse lastSeen field to numeric timestamp */
function parseLastSeen(lastSeen: string | number): number {
	return typeof lastSeen === 'string' ? new Date(lastSeen).getTime() : lastSeen;
}

/** Derive frequency from channel when not provided directly */
function channelToFrequency(channel: string | number): number {
	return (parseInt(String(channel)) || 0) * 5 + 2400;
}

/** Extract scalar fields from a simplified Kismet device */

function extractSimplifiedScalars(
	validated: any
): Pick<KismetDevice, 'manufacturer' | 'type' | 'packets' | 'datasize'> {
	return {
		manufacturer: validated.manufacturer || 'Unknown',
		type: (validated.type ?? 'unknown').toLowerCase(),
		packets: validated.packets || 0,
		datasize: validated.packets || 0
	};
}

/** Resolve frequency from validated device, falling back to channel-based derivation */
function resolveFrequency(freq: number | undefined, channel: number): number {
	return freq || channelToFrequency(channel);
}

/** Extract optional fields from a simplified Kismet device */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated schema output
function extractSimplifiedOptionals(validated: any): Pick<KismetDevice, 'ssid' | 'encryption'> {
	return {
		ssid: validated.ssid || validated.name || undefined,
		encryption: validated.encryption || validated.encryptionType || undefined
	};
}

/** Parse channel number from validated device */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated schema output
function parseChannel(validated: any): number {
	return parseInt(String(validated.channel)) || 0;
}

/** Build KismetDevice from validated simplified device data */
export function buildSimplifiedDevice(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- validated schema output
	validated: any,
	gpsPosition: GPSPosition | null,
	resolveLocation: LocationResolver
): KismetDevice {
	const rawSignal = validated.signal ?? DEFAULT_SIGNAL;
	const channel = parseChannel(validated);
	return {
		mac: validated.mac,
		last_seen: parseLastSeen(validated.lastSeen),
		signal: makeSignalBlock(rawSignal),
		...extractSimplifiedScalars(validated),
		channel,
		frequency: resolveFrequency(validated.frequency, channel),
		...extractSimplifiedOptionals(validated),
		location: resolveLocation(
			validated.location?.lat,
			validated.location?.lon,
			gpsPosition,
			validated.mac,
			rawSignal
		)
	};
}

/** Extract signal strength from raw Kismet signal field */

function extractObjectSignal(signal: Record<string, number>): number {
	return (
		signal['kismet.common.signal.last_signal'] ||
		signal['kismet.common.signal.max_signal'] ||
		DEFAULT_SIGNAL
	);
}

/** Extract signal from raw Kismet signal field (object or scalar) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
function extractRawSignal(signal: any): number {
	if (typeof signal === 'object' && signal !== null) return extractObjectSignal(signal);
	return signal || DEFAULT_SIGNAL;
}

/** Extract SSID from raw Kismet device dot11 fields */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
function extractDot11Ssid(dot11: any): string | undefined {
	return (
		dot11?.['dot11.device.last_beaconed_ssid'] ||
		dot11?.['dot11.device.advertised_ssid_map']?.ssid
	);
}

/** Extract SSID from raw Kismet device fields */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
function extractRawSsid(validated: any): string | undefined {
	return (
		extractDot11Ssid(validated['dot11.device']) ||
		validated['kismet.device.base.name'] ||
		undefined
	);
}

/** Extract text identity fields from a raw Kismet device */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
function extractRawIdentity(validated: any): Pick<KismetDevice, 'manufacturer' | 'type'> {
	return {
		manufacturer: validated['kismet.device.base.manuf'] || 'Unknown',
		type: (validated['kismet.device.base.type'] || 'Unknown').toLowerCase()
	};
}

/** Extract numeric fields from a raw Kismet device */

function extractRawMetrics(
	validated: any,
	channel: number
): Pick<KismetDevice, 'frequency' | 'packets' | 'datasize'> {
	return {
		frequency: validated['kismet.device.base.frequency'] || channelToFrequency(channel),
		packets: validated['kismet.device.base.packets.total'] || 0,
		datasize: validated['kismet.device.base.packets.total'] || 0
	};
}

/** Extract base identifiers from a raw Kismet device */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
function extractRawBase(validated: any): { mac: string; channel: number; lastSeen: number } {
	return {
		mac: validated['kismet.device.base.macaddr'] || 'Unknown',
		channel: parseInt(String(validated['kismet.device.base.channel'])) || 0,
		lastSeen: (validated['kismet.device.base.last_time'] || 0) * 1000
	};
}

/** Build KismetDevice from validated raw Kismet device data */
export function buildRawDevice(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Kismet schema
	validated: any,
	gpsPosition: GPSPosition | null,
	resolveLocation: LocationResolver
): KismetDevice {
	const rawSignal = extractRawSignal(validated['kismet.device.base.signal']);
	const { mac, channel, lastSeen } = extractRawBase(validated);
	const loc = validated['kismet.device.base.location'];
	return {
		mac,
		last_seen: lastSeen,
		signal: makeSignalBlock(rawSignal),
		...extractRawIdentity(validated),
		...extractRawMetrics(validated, channel),
		channel,
		ssid: extractRawSsid(validated),
		location: resolveLocation(
			loc?.['kismet.common.location.lat'],
			loc?.['kismet.common.location.lon'],
			gpsPosition,
			mac,
			rawSignal
		)
	};
}
