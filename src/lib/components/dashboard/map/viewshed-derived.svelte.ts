/** Viewshed derived reactive state — watches GPS + store params, fetches viewshed API. */
import { fromStore } from 'svelte/store';

import {
	viewshedComputedAgl,
	viewshedComputing,
	viewshedStore
} from '$lib/stores/dashboard/viewshed-store';
import { type GPSState, gpsStore } from '$lib/stores/tactical-map/gps-store';
import type { ViewshedBounds, ViewshedResult } from '$lib/types/viewshed';
import { logger } from '$lib/utils/logger';
import { GPS_STALE_TIMEOUT_MS } from '$lib/utils/rf-propagation';

import { ParamsMemo } from './viewshed-memo';

const DEBOUNCE_MS = 500;
const DEBOUNCE_OPACITY_MS = 150;

function hasValidGPSFix(gps: GPSState): boolean {
	return gps.status.hasGPSFix && !(gps.position.lat === 0 && gps.position.lon === 0);
}

/** Convert a data:image/png;base64,... URI to a blob: URL that MapLibre can fetch. */
function dataUriToBlobUrl(dataUri: string): string {
	const [header, b64] = dataUri.split(',');
	const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
	const bytes = atob(b64);
	const buf = new Uint8Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
	return URL.createObjectURL(new Blob([buf], { type: mime }));
}

export interface ViewshedDerivedState {
	readonly viewshedImageUrl: string | null;
	readonly viewshedBounds: ViewshedBounds | null;
	readonly viewshedActive: boolean;
	readonly viewshedInactiveReason: string | null;
	readonly isComputing: boolean;
	/** Last computed AGL from server (meters), only set when heightAglMode is 'auto' */
	readonly computedAglM: number | null;
}

/** Create all viewshed-derived reactive state. Call once from createMapState(). */
export function createViewshedDerivedState(): ViewshedDerivedState {
	const gps$ = fromStore(gpsStore);
	const vs$ = fromStore(viewshedStore);

	let viewshedImageUrl: string | null = $state(null);
	let viewshedBounds: ViewshedBounds | null = $state(null);
	let viewshedActive = $state(false);
	let viewshedInactiveReason: string | null = $state('Overlay disabled');
	let isComputing = $state(false);
	let computedAglM: number | null = $state(null);

	// Memoization: track last fetch inputs to skip redundant calls
	const memo = new ParamsMemo();

	// GPS stale tracking
	let lastGPSFixTime = 0;
	let lastKnownLat = 0;
	let lastKnownLon = 0;
	let gpsStaleTick = $state(0);
	let staleTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Debounce
	let debounceId: ReturnType<typeof setTimeout> | null = null;

	// In-flight abort
	let abortController: AbortController | null = null;

	// Track current blob URL for cleanup
	let currentBlobUrl: string | null = null;

	function scheduleStaleExpiry(remainingMs: number): void {
		if (staleTimeoutId !== null) return;
		staleTimeoutId = setTimeout(() => {
			staleTimeoutId = null;
			gpsStaleTick++;
		}, remainingMs);
	}

	function clearStaleTimer(): void {
		if (staleTimeoutId !== null) {
			clearTimeout(staleTimeoutId);
			staleTimeoutId = null;
		}
	}

	function clearOverlay(): void {
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}
		viewshedImageUrl = null;
		viewshedBounds = null;
		viewshedActive = false;
	}

	/** Track whether GPS was ever acquired (for stale vs never-had-fix messaging) */
	let hadGPSFix = false;

	function resolvePosition(gps: GPSState): { lat: number; lon: number } | null {
		if (hasValidGPSFix(gps)) {
			lastGPSFixTime = Date.now();
			lastKnownLat = gps.position.lat;
			lastKnownLon = gps.position.lon;
			hadGPSFix = true;
			clearStaleTimer();
			return { lat: gps.position.lat, lon: gps.position.lon };
		}
		// Stale fallback — freeze overlay at last known position for 30s
		if (lastGPSFixTime > 0) {
			const elapsed = Date.now() - lastGPSFixTime;
			if (elapsed < GPS_STALE_TIMEOUT_MS) {
				scheduleStaleExpiry(GPS_STALE_TIMEOUT_MS - elapsed);
				return { lat: lastKnownLat, lon: lastKnownLon };
			}
		}
		clearStaleTimer();
		return null;
	}

	function handleNoPosition(): void {
		clearOverlay();
		viewshedInactiveReason = hadGPSFix ? 'GPS signal lost' : 'No GPS fix';
	}

	function handleFetchError(err: unknown): void {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		logger.error('Viewshed fetch failed', { err }, 'viewshed-fetch-error');
		viewshedInactiveReason = 'Computation failed';
		clearOverlay();
	}

	async function fetchViewshed(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOpacity: number,
		redOpacity: number,
		gpsMslAltitude?: number
	): Promise<void> {
		abortController?.abort();
		abortController = new AbortController();

		const payload: Record<string, number | boolean> = {
			lat,
			lon,
			heightAgl,
			radiusM,
			greenOpacity,
			redOpacity
		};
		if (gpsMslAltitude !== undefined) payload.gpsMslAltitude = gpsMslAltitude;

		isComputing = true;
		viewshedComputing.set(true);
		try {
			const res = await fetch('/api/viewshed/compute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: abortController.signal
			});
			if (!res.ok) {
				viewshedInactiveReason = `API error: ${res.status}`;
				clearOverlay();
				return;
			}
			const result: ViewshedResult = await res.json();
			applyResult(result);
		} catch (err: unknown) {
			handleFetchError(err);
		} finally {
			isComputing = false;
			viewshedComputing.set(false);
		}
	}

	function applyResult(result: ViewshedResult): void {
		if (result.imageDataUri) {
			// Revoke previous blob URL to prevent memory leaks
			if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
			// MapLibre cannot fetch data: URIs — convert to blob: URL
			currentBlobUrl = dataUriToBlobUrl(result.imageDataUri);
			viewshedImageUrl = currentBlobUrl;
			viewshedBounds = result.bounds;
			viewshedActive = true;
			viewshedInactiveReason = null;
		} else {
			clearOverlay();
			viewshedInactiveReason =
				(result as ViewshedResult & { reason?: string }).reason ?? 'No DTED coverage';
		}
		// Capture server-computed AGL for UI display (null when in custom mode)
		computedAglM = result.meta.computedAglM ?? null;
		viewshedComputedAgl.set(computedAglM);
		logger.info(`Viewshed computed in ${result.meta.computeTimeMs}ms`, {
			cells: result.meta.cellCount,
			tiles: result.meta.tilesUsed
		});
	}

	// ── Helpers for the main effect ──────────────────────────────────

	function resolveGpsAltitude(
		vs: typeof vs$.current,
		gps: typeof gps$.current
	): number | undefined {
		return vs.heightAglMode === 'auto' && gps.status.altitude !== null
			? gps.status.altitude
			: undefined;
	}

	function scheduleFetch(
		vs: typeof vs$.current,
		pos: { lat: number; lon: number },
		gpsAlt: number | undefined,
		delay: number
	): void {
		if (debounceId !== null) clearTimeout(debounceId);
		const { heightAglM, radiusM, greenOpacity, redOpacity } = vs;
		debounceId = setTimeout(() => {
			debounceId = null;
			memo.save(pos.lat, pos.lon, heightAglM, radiusM, greenOpacity, redOpacity, gpsAlt);
			fetchViewshed(pos.lat, pos.lon, heightAglM, radiusM, greenOpacity, redOpacity, gpsAlt);
		}, delay);
	}

	// ── Main reactive effect ─────────────────────────────────────────

	$effect(() => {
		const gps = gps$.current;
		const vs = vs$.current;
		void gpsStaleTick; // Reactive dependency for stale timeout

		if (!vs.isEnabled) {
			clearOverlay();
			viewshedInactiveReason = 'Overlay disabled';
			return;
		}

		const pos = resolvePosition(gps);
		if (!pos) {
			handleNoPosition();
			return;
		}

		const gpsAlt = resolveGpsAltitude(vs, gps);
		const { heightAglM, radiusM, greenOpacity, redOpacity } = vs;
		const changeKind = memo.classifyChange(
			pos.lat,
			pos.lon,
			heightAglM,
			radiusM,
			greenOpacity,
			redOpacity,
			gpsAlt
		);
		if (changeKind === 'none') return;

		const delay = changeKind === 'opacity' ? DEBOUNCE_OPACITY_MS : DEBOUNCE_MS;
		scheduleFetch(vs, pos, gpsAlt, delay);

		return () => {
			if (debounceId !== null) clearTimeout(debounceId);
			abortController?.abort();
		};
	});

	return {
		get viewshedImageUrl() {
			return viewshedImageUrl;
		},
		get viewshedBounds() {
			return viewshedBounds;
		},
		get viewshedActive() {
			return viewshedActive;
		},
		get viewshedInactiveReason() {
			return viewshedInactiveReason;
		},
		get isComputing() {
			return isComputing;
		},
		get computedAglM() {
			return computedAglM;
		}
	};
}
