import type { Feature } from 'geojson';

import { logger } from '$lib/utils/logger';

import { SymbolFactory } from '../map/symbols/SymbolFactory';

/**
 * Parses a CoT XML string into a GeoJSON Feature with SIDC and properties.
 * Browser-only (uses DOMParser).
 */
export function parseCotToFeature(xml: string): Feature | null {
	if (typeof DOMParser === 'undefined') return null;

	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xml, 'text/xml');
		const event = doc.querySelector('event');
		if (!event) return null;

		const point = event.querySelector('point');
		if (!point) return null;

		const lat = parseFloat(point.getAttribute('lat') || '0');
		const lon = parseFloat(point.getAttribute('lon') || '0');
		if (lat === 0 && lon === 0) return null;

		const uid = event.getAttribute('uid') || 'unknown';
		const type = event.getAttribute('type') || 'a-u-G';
		const how = event.getAttribute('how') || 'm-g';
		const stale = event.getAttribute('stale');

		const detail = event.querySelector('detail');
		const contact = detail?.querySelector('contact');
		const callsign = contact?.getAttribute('callsign') || uid;

		// Convert CoT atom type to MIL-STD-2525C SIDC
		const sidc = SymbolFactory.cotTypeToSidc(type);

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: [lon, lat]
			},
			properties: {
				uid,
				type,
				sidc,
				label: callsign,
				how,
				stale,
				time: event.getAttribute('time')
			}
		};
	} catch (e) {
		logger.error('Failed to parse CoT', { error: e });
		return null;
	}
}
