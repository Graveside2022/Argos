import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

/** Which panel is open in the icon rail (null = closed) */
export const activePanel = writable<string | null>(null);

/** Bottom panel tab: 'terminal' | 'chat' | null (closed) */
export const activeBottomTab = writable<'terminal' | 'chat' | null>(null);

/** Shared bottom panel height (persisted to localStorage) */
const BOTTOM_PANEL_STORAGE_KEY = 'bottomPanelHeight';
const DEFAULT_BOTTOM_HEIGHT = 300;
const MIN_BOTTOM_HEIGHT = 100;
const MAX_BOTTOM_HEIGHT_PERCENT = 0.8;

function getInitialBottomHeight(): number {
	if (!browser) return DEFAULT_BOTTOM_HEIGHT;
	try {
		const stored = localStorage.getItem(BOTTOM_PANEL_STORAGE_KEY);
		if (stored)
			return Math.max(MIN_BOTTOM_HEIGHT, parseInt(stored, 10) || DEFAULT_BOTTOM_HEIGHT);
	} catch {
		/* use default */
	}
	return DEFAULT_BOTTOM_HEIGHT;
}

export const bottomPanelHeight = writable<number>(getInitialBottomHeight());

// Persist height
if (browser) {
	bottomPanelHeight.subscribe((h) => {
		localStorage.setItem(BOTTOM_PANEL_STORAGE_KEY, String(h));
	});
}

/** Whether the bottom panel is open */
export const isBottomPanelOpen = derived(activeBottomTab, ($tab) => $tab !== null);

/** Toggle a bottom panel tab: if already active, close; otherwise open */
export function toggleBottomTab(tab: 'terminal' | 'chat'): void {
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
