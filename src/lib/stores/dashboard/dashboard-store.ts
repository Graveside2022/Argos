import { derived, writable } from 'svelte/store';

import { browser } from '$app/environment';
import { persistedWritable } from '$lib/stores/persisted-writable';

/** Which panel is open in the icon rail ('overview' by default per Lunaris design) */
export const activePanel = writable<string | null>('overview');

/** Bottom panel tab type — gsm-evil removed (full-screen view), captures added */
type BottomTab = 'terminal' | 'chat' | 'logs' | 'captures' | 'devices' | null;

const VALID_TABS: BottomTab[] = ['terminal', 'chat', 'logs', 'captures', 'devices'];

export const activeBottomTab = persistedWritable<BottomTab>('activeBottomTab', null, {
	serialize: (tab) => (tab === null ? 'null' : tab),
	deserialize: (raw) => {
		// Graceful fallback: map removed 'gsm-evil' tab to null
		if (raw === 'gsm-evil') return null;
		return VALID_TABS.includes(raw as BottomTab) ? (raw as BottomTab) : null;
	}
});

/** Shared bottom panel height (persisted to localStorage) */
const DEFAULT_BOTTOM_HEIGHT = 240;
const MIN_BOTTOM_HEIGHT = 100;
const MAX_BOTTOM_HEIGHT_PERCENT = 0.8;

export const bottomPanelHeight = persistedWritable<number>(
	'bottomPanelHeight',
	DEFAULT_BOTTOM_HEIGHT,
	{
		serialize: (h) => String(h),
		deserialize: (raw) =>
			Math.max(MIN_BOTTOM_HEIGHT, parseInt(raw, 10) || DEFAULT_BOTTOM_HEIGHT)
	}
);

/** Whether the bottom panel is open */
export const isBottomPanelOpen = derived(activeBottomTab, ($tab) => $tab !== null);

/** Toggle a bottom panel tab: if already active, close; otherwise open */
export function toggleBottomTab(tab: 'terminal' | 'chat' | 'logs' | 'captures' | 'devices'): void {
	activeBottomTab.update((current) => (current === tab ? null : tab));
}

/** Close the bottom panel */
export function closeBottomPanel(): void {
	activeBottomTab.set(null);
}

/** Set bottom panel height with clamping */
export function setBottomPanelHeight(height: number): void {
	const maxHeight = browser ? window.innerHeight * MAX_BOTTOM_HEIGHT_PERCENT : 600;
	bottomPanelHeight.set(Math.max(MIN_BOTTOM_HEIGHT, Math.min(maxHeight, height)));
}

/**
 * What the main content area shows.
 * 'map' = default map view (State 1 or 2)
 * 'kismet' | 'gsm-evil' | 'hackrf' | etc. = full-screen tool view (State 3)
 */
export type ActiveView =
	| 'map'
	| 'kismet'
	| 'openwebrx'
	| 'bettercap'
	| 'hackrf'
	| 'gsm-evil'
	| 'rtl-433'
	| 'btle'
	| 'droneid'
	| 'pagermon'
	| 'rf-emitter'
	| 'wifite'
	| 'wigletotak'
	| 'tak-config'
	| 'logs-analytics';

export const activeView = writable<ActiveView>('map');

/** Toggle a panel: if already active, close it; otherwise open it */
export function togglePanel(panel: string): void {
	activePanel.update((current) => (current === panel ? null : panel));
}

/** Map layer visibility — shared between LayersPanel and DashboardMap */
export const layerVisibility = writable<Record<string, boolean>>({
	deviceDots: true, // Default to Symbols now? Requirement says "Replace dots"
	milSyms: false,
	connectionLines: false,
	cellTowers: false,
	signalMarkers: false,
	accuracyCircle: true
});

/** Toggle a single map layer on/off */
export function toggleLayerVisibility(key: string): void {
	layerVisibility.update((v) => ({ ...v, [key]: !v[key] }));
}

/** Shared isolated device MAC — when set, DevicesPanel shows only this AP + clients.
 *  Set from DashboardMap on device click, read by DevicesPanel. */
export const isolatedDeviceMAC = writable<string | null>(null);

/** Isolate a device in the table (set from map click or table click) */
export function isolateDevice(mac: string | null): void {
	isolatedDeviceMAC.set(mac);
	// Auto-open devices tab when isolating from map
	if (mac !== null) {
		activeBottomTab.update((current) => (current === 'devices' ? current : 'devices'));
	}
}

/** Signal band filter — which RSSI bands are visible on the map */
const ALL_BANDS = ['critical', 'strong', 'good', 'fair', 'weak', 'none'];
export const activeBands = writable<Set<string>>(new Set(ALL_BANDS));

/** Toggle a signal strength band on/off */
export function toggleBand(key: string): void {
	activeBands.update((s) => {
		const next = new Set(s);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});
}
