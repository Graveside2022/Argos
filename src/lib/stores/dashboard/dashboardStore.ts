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
