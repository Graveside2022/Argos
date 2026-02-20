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

/**
 * Filters and sorts device list. When isolatedMAC is set,
 * returns only that AP and its clients (unfiltered).
 */
export function filterAndSortDevices(
	allDevices: Map<string, KismetDevice>,
	isolatedMAC: string | null,
	options: FilterOptions
): KismetDevice[] {
	// Isolation mode: show only the AP and its clients
	if (isolatedMAC) {
		const ap = allDevices.get(isolatedMAC);
		if (!ap) return [];
		const result: KismetDevice[] = [ap];
		if (ap.clients?.length) {
			for (const clientMac of ap.clients) {
				const client = allDevices.get(clientMac);
				if (client) result.push(client);
			}
		}
		return result;
	}

	const q = options.searchQuery.toLowerCase().trim();
	const all = Array.from(allDevices.values());

	return all
		.filter((d) => {
			const rssi = getRSSI(d);
			if (options.shouldHideNoSignal && rssi === 0) return false;
			const band = getSignalBandKey(rssi);
			if (!options.activeBands.has(band)) return false;
			if (options.shouldShowOnlyWithClients && !(d.clients && d.clients.length > 0))
				return false;
			if (!q) return true;
			const mac = (d.mac || '').toLowerCase();
			const ssid = (d.ssid || '').toLowerCase();
			const mfr = (d.manufacturer || d.manuf || '').toLowerCase();
			return mac.includes(q) || ssid.includes(q) || mfr.includes(q);
		})
		.sort((a, b) => {
			let cmp = 0;
			if (options.sortColumn === 'mac') {
				cmp = (a.mac || '').localeCompare(b.mac || '');
			} else if (options.sortColumn === 'rssi') {
				const aVal = getRSSI(a) === 0 ? -999 : getRSSI(a);
				const bVal = getRSSI(b) === 0 ? -999 : getRSSI(b);
				cmp = aVal - bVal;
			} else if (options.sortColumn === 'type') {
				const order: Record<string, number> = { AP: 0, Client: 1, Bridged: 2, 'Ad-Hoc': 3 };
				cmp = (order[a.type] ?? 4) - (order[b.type] ?? 4);
			} else if (options.sortColumn === 'channel') {
				cmp = (a.channel || 0) - (b.channel || 0);
			} else if (options.sortColumn === 'packets') {
				cmp = (a.packets || 0) - (b.packets || 0);
			} else if (options.sortColumn === 'data') {
				cmp = (a.datasize || a.dataSize || 0) - (b.datasize || b.dataSize || 0);
			}
			return options.sortDirection === 'asc' ? cmp : -cmp;
		});
}
