/**
 * Viewshed derived reactive state for the dashboard map.
 *
 * Watches GPS position + viewshed store parameters. When enabled and
 * GPS is available, fetches /api/viewshed/compute and exposes the
 * resulting PNG data URI + bounds for the MapLibre ImageSource overlay.
 *
 * Replaces rf-range-derived.svelte.ts (Friis concentric rings).
 */
import { fromStore } from 'svelte/store';

import { viewshedStore } from '$lib/stores/dashboard/viewshed-store';
import { type GPSState, gpsStore } from '$lib/stores/tactical-map/gps-store';
import type { ViewshedBounds, ViewshedResult } from '$lib/types/viewshed';
import { haversineMeters } from '$lib/utils/geo';
import { logger } from '$lib/utils/logger';
import { GPS_STALE_TIMEOUT_MS } from '$lib/utils/rf-propagation';

// ── Constants ────────────────────────────────────────────────────────

/** Minimum position delta (meters) to trigger a refetch */
const POSITION_DELTA_M = 50;

/** Debounce delay after parameter changes (ms) */
const DEBOUNCE_MS = 500;

// ── Helpers ──────────────────────────────────────────────────────────

function hasValidGPSFix(gps: GPSState): boolean {
	return gps.status.hasGPSFix && !(gps.position.lat === 0 && gps.position.lon === 0);
}

// ── Exported state factory ───────────────────────────────────────────

export interface ViewshedDerivedState {
	readonly viewshedImageUrl: string | null;
	readonly viewshedBounds: ViewshedBounds | null;
	readonly viewshedActive: boolean;
	readonly viewshedInactiveReason: string | null;
	readonly isComputing: boolean;
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

	// Memoization: track last fetch inputs to skip redundant calls
	let prevLat = Infinity;
	let prevLon = Infinity;
	let prevHeightAgl = 0;
	let prevRadiusM = 0;
	let prevGreenOpacity = 0;
	let prevRedOpacity = 0;

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
		viewshedImageUrl = null;
		viewshedBounds = null;
		viewshedActive = false;
	}

	function resolvePosition(gps: GPSState): { lat: number; lon: number } | null {
		if (hasValidGPSFix(gps)) {
			lastGPSFixTime = Date.now();
			lastKnownLat = gps.position.lat;
			lastKnownLon = gps.position.lon;
			clearStaleTimer();
			return { lat: gps.position.lat, lon: gps.position.lon };
		}
		// Stale fallback
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

	function hasParamsChanged(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number
	): boolean {
		const posDelta = haversineMeters(prevLat, prevLon, lat, lon);
		if (posDelta >= POSITION_DELTA_M) return true;
		return (
			heightAgl !== prevHeightAgl ||
			radiusM !== prevRadiusM ||
			greenOp !== prevGreenOpacity ||
			redOp !== prevRedOpacity
		);
	}

	function saveMemoState(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number
	): void {
		prevLat = lat;
		prevLon = lon;
		prevHeightAgl = heightAgl;
		prevRadiusM = radiusM;
		prevGreenOpacity = greenOp;
		prevRedOpacity = redOp;
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
		redOpacity: number
	): Promise<void> {
		abortController?.abort();
		abortController = new AbortController();

		isComputing = true;
		try {
			const res = await fetch('/api/viewshed/compute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ lat, lon, heightAgl, radiusM, greenOpacity, redOpacity }),
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
		}
	}

	function applyResult(result: ViewshedResult): void {
		if (result.imageDataUri) {
			viewshedImageUrl = result.imageDataUri;
			viewshedBounds = result.bounds;
			viewshedActive = true;
			viewshedInactiveReason = null;
		} else {
			clearOverlay();
			viewshedInactiveReason =
				(result as ViewshedResult & { reason?: string }).reason ?? 'No DTED coverage';
		}
		logger.info(`Viewshed computed in ${result.meta.computeTimeMs}ms`, {
			cells: result.meta.cellCount,
			tiles: result.meta.tilesUsed
		});
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
			clearOverlay();
			viewshedInactiveReason = 'No GPS fix';
			return;
		}

		const { heightAglM, radiusM, greenOpacity, redOpacity } = vs;
		if (!hasParamsChanged(pos.lat, pos.lon, heightAglM, radiusM, greenOpacity, redOpacity)) {
			return;
		}

		// Debounce to avoid rapid API calls during slider changes.
		// Memo is saved inside the callback so rapid changes aren't dropped.
		if (debounceId !== null) clearTimeout(debounceId);
		debounceId = setTimeout(() => {
			debounceId = null;
			saveMemoState(pos.lat, pos.lon, heightAglM, radiusM, greenOpacity, redOpacity);
			fetchViewshed(pos.lat, pos.lon, heightAglM, radiusM, greenOpacity, redOpacity);
		}, DEBOUNCE_MS);

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
		}
	};
}
