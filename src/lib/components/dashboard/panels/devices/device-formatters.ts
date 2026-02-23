/**
 * Pure formatting functions for device table display.
 * Extracted from DevicesPanel.svelte — zero external dependencies.
 */
import type { KismetDevice } from '$lib/kismet/types';

/** Get RSSI value, treating 0 as no-signal */
export function getRSSI(device: KismetDevice): number {
	return device.signal?.last_signal ?? 0;
}

export function formatFreq(freq: number): string {
	if (!freq) return '-';
	if (freq >= 1000000) return `${(freq / 1000000).toFixed(1)}G`;
	if (freq >= 1000) return `${(freq / 1000).toFixed(0)}M`;
	return `${freq}`;
}

/** Resolve encryption array to display string. */
function encLabel(enc: string[]): string {
	if (enc.length === 0) return '-';
	if (enc.length === 1 && enc[0] === 'Open') return 'Open';
	return enc.join('/');
}

export function formatEncryption(device: KismetDevice): string {
	const enc = device.encryption || device.encryptionType;
	return enc ? encLabel(enc) : '-';
}

/** Convert a timestamp (seconds or ms) to milliseconds. */
function toMs(ts: number): number {
	return ts < 1e12 ? ts * 1000 : ts;
}

/** Threshold-based time-ago formatting. */
const TIME_AGO_THRESHOLDS: [number, (s: number) => string][] = [
	[86400, (s) => `${Math.floor(s / 86400)}d`],
	[3600, (s) => `${Math.floor(s / 3600)}h`],
	[60, (s) => `${Math.floor(s / 60)}m`]
];

/** Format seconds elapsed as a human-readable duration. */
function formatElapsed(secs: number): string {
	if (secs < 0 || isNaN(secs)) return '-';
	const match = TIME_AGO_THRESHOLDS.find(([min]) => secs >= min);
	return match ? match[1](secs) : `${secs}s`;
}

/** Resolve last-seen timestamp from multiple possible device fields. */
function resolveLastSeenTs(device: KismetDevice): number {
	return device.lastSeen || device.last_seen || device.last_time || 0;
}

export function formatLastSeen(device: KismetDevice): string {
	const ts = resolveLastSeenTs(device);
	if (!ts) return '-';
	const secs = Math.floor((Date.now() - toMs(ts)) / 1000);
	return secs >= 0 && secs < 5 ? 'now' : formatElapsed(secs);
}

export function formatFirstSeen(device: KismetDevice): string {
	const ts = device.firstSeen || 0;
	if (!ts) return '-';
	return formatElapsed(Math.floor((Date.now() - toMs(ts)) / 1000));
}

export function formatPackets(n: number): string {
	if (!n) return '-';
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return String(n);
}

export function formatDataSize(bytes: number): string {
	if (!bytes) return '-';
	if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}G`;
	if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}M`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}K`;
	return `${bytes}B`;
}

export function hasConnections(device: KismetDevice): boolean {
	return !!(device.clients?.length || device.parentAP);
}

export function sortIndicator(
	sortColumn: string,
	sortDirection: 'asc' | 'desc',
	col: string
): string {
	if (sortColumn !== col) return '';
	return sortDirection === 'asc' ? ' ^' : ' v';
}
