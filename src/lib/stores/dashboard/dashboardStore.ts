import { writable } from 'svelte/store';

/** Which panel is open in the icon rail (null = closed) */
export const activePanel = writable<string | null>(null);

/**
 * What the main content area shows.
 * 'map' = default map view (State 1 or 2)
 * 'kismet' | 'gsm-evil' | 'hackrf' | etc. = full-screen tool view (State 3)
 */
export const activeView = writable<string>('map');

/** Toggle a panel: if already active, close it; otherwise open it */
export function togglePanel(panel: string): void {
	activePanel.update((current) => (current === panel ? null : panel));
}

/** Map layer visibility — shared between LayersPanel and DashboardMap */
export const layerVisibility = writable<Record<string, boolean>>({
	deviceDots: true,
	cellTowers: false,
	signalMarkers: true,
	accuracyCircle: true
});

/** Toggle a single map layer on/off */
export function toggleLayerVisibility(key: string): void {
	layerVisibility.update((v) => ({ ...v, [key]: !v[key] }));
}

/** Signal band filter — which RSSI bands are visible on the map */
const ALL_BANDS = ['critical', 'strong', 'good', 'fair', 'weak'];
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
