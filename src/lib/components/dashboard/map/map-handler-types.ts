/**
 * Shared types for map click/interaction handlers.
 * Extracted to break the circular dependency between map-handlers.ts and map-handlers-helpers.ts.
 */

import type { Affiliation } from '$lib/stores/tactical-map/kismet-store';

export interface PopupState {
	ssid: string;
	mac: string;
	rssi: number;
	type: string;
	manufacturer: string;
	channel: number;
	frequency: number;
	packets: number;
	last_seen: number;
	clientCount: number;
	parentAP: string;
	affiliation: Affiliation;
}

export interface TowerPopupState {
	radio: string;
	mcc: number;
	mnc: number;
	lac: number;
	ci: number;
	range: number;
	samples: number;
	avgSignal: number;
}
