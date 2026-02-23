/**
 * Device filtering and sorting logic — pure functions operating on arrays.
 * Extracted from DevicesPanel.svelte to separate data transformation from presentation.
 */
import type { KismetDevice } from '$lib/kismet/types';
import { getSignalBandKey } from '$lib/utils/signal-utils';

import { getRSSI } from './device-formatters';

export type SortColumn = 'mac' | 'rssi' | 'type' | 'channel' | 'packets' | 'data';

export interface FilterOptions {
	searchQuery: string;
	shouldHideNoSignal: boolean;
	shouldShowOnlyWithClients: boolean;
	activeBands: Set<string>;
	sortColumn: SortColumn;
	sortDirection: 'asc' | 'desc';
}

/** Collect an AP and its clients from the device map. */
function collectIsolatedDevices(
	allDevices: Map<string, KismetDevice>,
	isolatedMAC: string
): KismetDevice[] {
	const ap = allDevices.get(isolatedMAC);
	if (!ap) return [];
	const result: KismetDevice[] = [ap];
	for (const clientMac of ap.clients ?? []) {
		const client = allDevices.get(clientMac);
		if (client) result.push(client);
	}
	return result;
}

/** Build a searchable text blob from a device's key fields. */
function searchableText(d: KismetDevice): string {
	return [d.mac, d.ssid, d.manufacturer || d.manuf].join('\0').toLowerCase();
}

/** Check if a device matches the text search query. */
function matchesSearch(d: KismetDevice, q: string): boolean {
	return !q || searchableText(d).includes(q);
}

/** Check if a device passes signal and band filters. */
function passesSignalFilters(d: KismetDevice, options: FilterOptions): boolean {
	const rssi = getRSSI(d);
	if (options.shouldHideNoSignal && rssi === 0) return false;
	return options.activeBands.has(getSignalBandKey(rssi));
}

/** Check if a device passes all filter criteria. */
function passesFilters(d: KismetDevice, options: FilterOptions, q: string): boolean {
	if (!passesSignalFilters(d, options)) return false;
	if (options.shouldShowOnlyWithClients && !d.clients?.length) return false;
	return matchesSearch(d, q);
}

/** RSSI sort value — treat 0 (no signal) as extremely weak. */
function rssiSortVal(d: KismetDevice): number {
	const r = getRSSI(d);
	return r === 0 ? -999 : r;
}

/** Type ordering for AP > Client > Bridged > Ad-Hoc > Other. */
const TYPE_ORDER: Record<string, number> = { AP: 0, Client: 1, Bridged: 2, 'Ad-Hoc': 3 };

/** Sort value extractors by column. */
const SORT_EXTRACTORS: Record<SortColumn, (d: KismetDevice) => string | number> = {
	mac: (d) => d.mac || '',
	rssi: rssiSortVal,
	type: (d) => TYPE_ORDER[d.type] ?? 4,
	channel: (d) => d.channel || 0,
	packets: (d) => d.packets || 0,
	data: (d) => d.datasize || d.dataSize || 0
};

/** Compare two sort values (ascending). */
function compareAsc(a: string | number, b: string | number): number {
	if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
	return (a as number) - (b as number);
}

/**
 * Filters and sorts device list. When isolatedMAC is set,
 * returns only that AP and its clients (unfiltered).
 */
export function filterAndSortDevices(
	allDevices: Map<string, KismetDevice>,
	isolatedMAC: string | null,
	options: FilterOptions
): KismetDevice[] {
	if (isolatedMAC) return collectIsolatedDevices(allDevices, isolatedMAC);

	const q = options.searchQuery.toLowerCase().trim();
	const extract = SORT_EXTRACTORS[options.sortColumn];
	const mult = options.sortDirection === 'asc' ? 1 : -1;

	return Array.from(allDevices.values())
		.filter((d) => passesFilters(d, options, q))
		.sort((a, b) => compareAsc(extract(a), extract(b)) * mult);
}
