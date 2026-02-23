import type { Feature } from 'geojson';

import { logger } from '$lib/utils/logger';

import { SymbolFactory } from '../map/symbols/symbol-factory';

/** Read an attribute from an element, returning fallback if absent. */
function attr(el: Element, name: string, fallback: string): string {
	return el.getAttribute(name) || fallback;
}

/** Extract lat/lon from a <point> element. Returns null if invalid (0,0). */
function parsePoint(point: Element): { lat: number; lon: number } | null {
	const lat = parseFloat(attr(point, 'lat', '0'));
	const lon = parseFloat(attr(point, 'lon', '0'));
	return lat === 0 && lon === 0 ? null : { lat, lon };
}

/** Extract event metadata and build properties. */
function buildFeatureProps(
	event: Element,
	uid: string,
	coords: { lat: number; lon: number }
): Feature {
	const type = attr(event, 'type', 'a-u-G');
	const callsign =
		event.querySelector('detail')?.querySelector('contact')?.getAttribute('callsign') || uid;
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [coords.lon, coords.lat] },
		properties: {
			uid,
			type,
			sidc: SymbolFactory.cotTypeToSidc(type),
			label: callsign,
			how: attr(event, 'how', 'm-g'),
			stale: event.getAttribute('stale'),
			time: event.getAttribute('time')
		}
	};
}

/** Parse the XML and extract the event+point pair. Returns null on failure. */
function extractEventAndPoint(xml: string): { event: Element; point: Element } | null {
	const event = new DOMParser().parseFromString(xml, 'text/xml').querySelector('event');
	const point = event?.querySelector('point');
	return event && point ? { event, point } : null;
}

/**
 * Parses a CoT XML string into a GeoJSON Feature with SIDC and properties.
 * Browser-only (uses DOMParser).
 */
export function parseCotToFeature(xml: string): Feature | null {
	if (typeof DOMParser === 'undefined') return null;
	try {
		const els = extractEventAndPoint(xml);
		if (!els) return null;
		const coords = parsePoint(els.point);
		if (!coords) return null;
		return buildFeatureProps(els.event, attr(els.event, 'uid', 'unknown'), coords);
	} catch (e) {
		logger.error('Failed to parse CoT', { error: e });
		return null;
	}
}
