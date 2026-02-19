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

export function formatEncryption(device: KismetDevice): string {
	const enc = device.encryption || device.encryptionType;
	if (!enc || enc.length === 0) return '-';
	if (enc.length === 1 && enc[0] === 'Open') return 'Open';
	return enc.join('/');
}

export function formatLastSeen(device: KismetDevice): string {
	const ts = device.lastSeen || device.last_seen || device.last_time || 0;
	if (!ts) return '-';
	const msTs = ts < 1e12 ? ts * 1000 : ts;
	const secs = Math.floor((Date.now() - msTs) / 1000);
	if (secs < 0 || isNaN(secs)) return '-';
	if (secs < 5) return 'now';
	if (secs < 60) return `${secs}s`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
	return `${Math.floor(secs / 86400)}d`;
}

export function formatFirstSeen(device: KismetDevice): string {
	const ts = device.firstSeen || 0;
	if (!ts) return '-';
	const msTs = ts < 1e12 ? ts * 1000 : ts;
	const secs = Math.floor((Date.now() - msTs) / 1000);
	if (secs < 0 || isNaN(secs)) return '-';
	if (secs < 60) return `${secs}s`;
	if (secs < 3600) return `${Math.floor(secs / 60)}m`;
	if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
	return `${Math.floor(secs / 86400)}d`;
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
