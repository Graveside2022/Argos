/**
 * RF Propagation overlay manager — MapLibre ImageSource lifecycle.
 *
 * svelte-maplibre-gl lacks ImageSource support, so we manage sources/layers
 * directly via the MapLibre GL JS API. Each overlay entry (from rf-overlay-store)
 * maps to a pair of map.addSource('image') + map.addLayer('raster').
 *
 * Converts the base64 data URI from the API into a Blob URL, which MapLibre
 * fetches via its internal pipeline. Requires `blob:` in the CSP connect-src
 * directive (MapLibre uses fetch(), not <img>, to load ImageSource URLs).
 *
 * @module
 */

import type maplibregl from 'maplibre-gl';
import { writable } from 'svelte/store';

import type { RFOverlayEntry } from '$lib/stores/dashboard/rf-overlay-store';
import type { PropagationBounds } from '$lib/types/rf-propagation';

/**
 * Overlay error store — set when MapLibre rejects a source or layer add.
 * Cleared at the start of each sync cycle. Subscribe in UI to surface failures.
 */
export const overlayError = writable<string | null>(null);

// ── Helpers ─────────────────────────────────────────────────────────

/** Convert a base64 data URI to an ArrayBuffer */
function dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
	const base64 = dataUri.split(',')[1];
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/** Convert PropagationBounds to MapLibre image coordinates (clockwise from top-left) */
function boundsToCoordinates(
	b: PropagationBounds
): [[number, number], [number, number], [number, number], [number, number]] {
	return [
		[b.west, b.north], // top-left
		[b.east, b.north], // top-right
		[b.east, b.south], // bottom-right
		[b.west, b.south] // bottom-left
	];
}

// ── Overlay tracking ───────────────────────────────────────────────

/** Tracked overlay on the map (source + layer) */
interface TrackedOverlay {
	sourceId: string;
	layerId: string;
}

/** Active overlays keyed by store entry ID */
const tracked = new Map<string, TrackedOverlay>();

/** Active blob URLs for cleanup */
const blobUrls = new Map<string, string>();

/** Register a blob URL for an entry, returning the URL */
function createBlobUrl(entry: RFOverlayEntry): string {
	const arrayBuf = dataUriToArrayBuffer(entry.imageDataUri);
	const blob = new Blob([arrayBuf], { type: 'image/png' });
	const blobUrl = URL.createObjectURL(blob);
	blobUrls.set(entry.id, blobUrl);
	return blobUrl;
}

/** Add the ImageSource to the map; returns false on failure */
function addImageSource(
	map: maplibregl.Map,
	sourceId: string,
	blobUrl: string,
	entry: RFOverlayEntry
): boolean {
	try {
		map.addSource(sourceId, {
			type: 'image',
			url: blobUrl,
			coordinates: boundsToCoordinates(entry.bounds)
		});
		return true;
	} catch (err) {
		const msg = `Failed to add RF overlay source: ${String(err)}`;
		console.error('RF overlay: failed to add source', sourceId, err);
		overlayError.set(msg);
		URL.revokeObjectURL(blobUrl);
		blobUrls.delete(entry.id);
		return false;
	}
}

/** Add the raster layer to the map; returns false on failure */
function addRasterLayer(
	map: maplibregl.Map,
	layerId: string,
	sourceId: string,
	entry: RFOverlayEntry
): boolean {
	// Insert below interactive layers so device dots/towers remain clickable
	const beforeId = map.getLayer('detection-range-fill') ? 'detection-range-fill' : undefined;
	try {
		map.addLayer(
			{
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': entry.opacity,
					'raster-fade-duration': 0
				}
			},
			beforeId
		);
		return true;
	} catch (err) {
		const msg = `Failed to add RF overlay layer: ${String(err)}`;
		console.error('RF overlay: failed to add layer', layerId, err);
		overlayError.set(msg);
		return false;
	}
}

/** Add a single overlay to the map */
function addOverlayToMap(map: maplibregl.Map, entry: RFOverlayEntry): void {
	const sourceId = `rf-prop-src-${entry.id}`;
	const layerId = `rf-prop-layer-${entry.id}`;

	if (map.getSource(sourceId)) return;

	const blobUrl = createBlobUrl(entry);
	if (!addImageSource(map, sourceId, blobUrl, entry)) return;
	if (!addRasterLayer(map, layerId, sourceId, entry)) return;

	if (!entry.visible) map.setLayoutProperty(layerId, 'visibility', 'none');

	tracked.set(entry.id, { sourceId, layerId });

	// Zoom to show the full overlay extent
	const { north, south, east, west } = entry.bounds;
	map.fitBounds([west, south, east, north], { padding: 40, maxZoom: 13 });
}

/** Remove a single overlay from the map */
function removeOverlayFromMap(map: maplibregl.Map, entryId: string): void {
	const t = tracked.get(entryId);
	if (!t) return;

	if (map.getLayer(t.layerId)) map.removeLayer(t.layerId);
	if (map.getSource(t.sourceId)) map.removeSource(t.sourceId);

	const blobUrl = blobUrls.get(entryId);
	if (blobUrl) {
		URL.revokeObjectURL(blobUrl);
		blobUrls.delete(entryId);
	}

	tracked.delete(entryId);
}

/** Remove all tracked overlays from the map */
export function clearAllOverlays(map: maplibregl.Map): void {
	// Spread keys first — removeOverlayFromMap deletes from `tracked`
	for (const entryId of [...tracked.keys()]) {
		removeOverlayFromMap(map, entryId);
	}
}

/**
 * Sync map overlays with the current store state.
 *
 * Called reactively from dashboard-map-logic when rfOverlays or layerVisibility changes.
 * Adds new overlays, removes stale ones, and updates visibility/opacity.
 *
 * If the map style hasn't loaded yet, defers until the 'styledata' event fires.
 */
export function syncRFOverlays(
	map: maplibregl.Map,
	entries: RFOverlayEntry[],
	globalVisible: boolean
): void {
	if (!map.isStyleLoaded()) {
		map.once('styledata', () => applySync(map, entries, globalVisible));
		return;
	}
	applySync(map, entries, globalVisible);
}

/** Remove tracked overlays that are no longer in the entry set */
function removeStaleOverlays(map: maplibregl.Map, entryIds: Set<string>): void {
	for (const trackedId of [...tracked.keys()]) {
		if (!entryIds.has(trackedId)) removeOverlayFromMap(map, trackedId);
	}
}

/** Apply visibility and opacity to a tracked layer */
function applyLayerProperties(
	map: maplibregl.Map,
	t: TrackedOverlay,
	entry: RFOverlayEntry,
	globalVisible: boolean
): void {
	const visibilities = ['none', 'visible'] as const;
	const vis = visibilities[Number(globalVisible && entry.visible)];
	map.setLayoutProperty(t.layerId, 'visibility', vis);
	map.setPaintProperty(t.layerId, 'raster-opacity', entry.opacity);
}

/** Sync a single entry's visibility and opacity on the map */
function syncEntryLayer(map: maplibregl.Map, entry: RFOverlayEntry, globalVisible: boolean): void {
	if (!tracked.has(entry.id)) addOverlayToMap(map, entry);

	const t = tracked.get(entry.id);
	if (!t) return;
	if (!map.getLayer(t.layerId)) return;

	applyLayerProperties(map, t, entry, globalVisible);
}

function applySync(map: maplibregl.Map, entries: RFOverlayEntry[], globalVisible: boolean): void {
	overlayError.set(null);
	const entryIds = new Set(entries.map((e) => e.id));
	removeStaleOverlays(map, entryIds);
	for (const entry of entries) syncEntryLayer(map, entry, globalVisible);
}
