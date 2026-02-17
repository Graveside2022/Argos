import type { Feature } from 'geojson';

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
		const uid = event.getAttribute('uid') || 'unknown';
		const type = event.getAttribute('type') || 'a-u-G'; // Standard Ground Unknown fallback
		const how = event.getAttribute('how') || 'm-g';

		const detail = event.querySelector('detail');
		const contact = detail?.querySelector('contact');
		const callsign = contact?.getAttribute('callsign') || uid;

		// Map CoT type to SIDC
		// CoT type usually maps loosely to SIDC.
		// E.g. a-f-G-U-C -> SIDC
		// If the type IS a SIDC or partial SIDC ?
		// Or we use SymbolFactory to generate SIDC from CoT type.
		// For now, let's assume CoT type is close enough or use a simple mapping.
		// SymbolFactory.getSidcForDevice? No that was for Kismet types.

		// If type starts with 'a-', it's an atom.
		// We can pass the type directly if it's 2525B/C compatible, or use mil-sym-js to parse it.
		// mil-sym-js `Symbol` constructor handles SIDC or options.
		// We'll pass `type` as SIDC if it looks like one, or map it.

		// Basic mapping for MVP: direct pass-through of type as SIDC
		// (TAK often uses 2525B-like strings in 'type' field)

		const sidc = type;

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
				// Add timestamp etc
				time: event.getAttribute('time')
			}
		};
	} catch (e) {
		console.error('Failed to parse CoT', e);
		return null;
	}
}
