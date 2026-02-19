import type { Feature, FeatureCollection } from 'geojson';

import { resolveThemeColor } from '$lib/utils/theme-colors';

/**
 * Deterministic angle from MAC address for radial client spreading.
 * Each client gets a stable unique position around its AP.
 */
export function macToAngle(mac: string): number {
	let hash = 0;
	for (let i = 0; i < mac.length; i++) {
		hash = (hash << 5) - hash + mac.charCodeAt(i);
		hash |= 0;
	}
	return (Math.abs(hash) % 360) * (Math.PI / 180);
}

/**
 * Estimate distance from RSSI using log-distance path loss model.
 * PL(d) = 40 + 10·n·log₁₀(d), n=3.3 (suburban w/ buildings)
 * Signal(d) = -12 - 33·log₁₀(d) → d = 10^((-12 - rssi) / 33)
 * Clamped to [10m, 300m] to match detection range bands.
 */
export function rssiToMeters(rssi: number): number {
	if (rssi === 0 || rssi >= -12) return 40; // no-signal fallback
	const d = Math.pow(10, (-12 - rssi) / 33);
	return Math.max(10, Math.min(300, d));
}

/**
 * Returns [lon, lat] — offset if client shares AP's exact coords, otherwise original.
 * Uses RSSI-based distance estimation: strong signal → close, weak → far.
 */
export function spreadClientPosition(
	clientLon: number,
	clientLat: number,
	apLon: number,
	apLat: number,
	clientMac: string,
	clientRssi: number
): [number, number] {
	const samePos = Math.abs(clientLat - apLat) < 0.00001 && Math.abs(clientLon - apLon) < 0.00001;
	if (!samePos) return [clientLon, clientLat];
	const distMeters = rssiToMeters(clientRssi);
	const angle = macToAngle(clientMac);
	const dLat = (distMeters * Math.cos(angle)) / 111320;
	const dLon = (distMeters * Math.sin(angle)) / (111320 * Math.cos((apLat * Math.PI) / 180));
	return [apLon + dLon, apLat + dLat];
}

/**
 * Quadratic bezier curve between two points (bows outward for visual separation).
 */
export function bezierArc(
	start: [number, number],
	end: [number, number],
	steps = 16
): [number, number][] {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dist = Math.sqrt(dx * dx + dy * dy);
	if (dist < 1e-8) return [start, end];
	// Control point: perpendicular offset at midpoint (15% of line length)
	const mx = (start[0] + end[0]) / 2;
	const my = (start[1] + end[1]) / 2;
	const bow = dist * 0.15;
	const cx = mx - (dy / dist) * bow;
	const cy = my + (dx / dist) * bow;
	const pts: [number, number][] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		pts.push([
			u * u * start[0] + 2 * u * t * cx + t * t * end[0],
			u * u * start[1] + 2 * u * t * cy + t * t * end[1]
		]);
	}
	return pts;
}

/**
 * Build a GeoJSON polygon approximating a circle (for accuracy visualization).
 */
export function createCirclePolygon(
	lng: number,
	lat: number,
	radiusMeters: number,
	steps = 48
): Feature {
	const coords: [number, number][] = [];
	const earthRadius = 6371000;
	for (let i = 0; i <= steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const dLat = (radiusMeters * Math.cos(angle)) / earthRadius;
		const dLng =
			(radiusMeters * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
		coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
	}
	return {
		type: 'Feature',
		properties: {},
		geometry: { type: 'Polygon', coordinates: [coords] }
	};
}

/**
 * Build a GeoJSON donut/ring polygon for signal range bands.
 * When innerRadius > 0, creates a ring (annulus) with a hole punched out.
 */
export function createRingPolygon(
	lng: number,
	lat: number,
	outerRadius: number,
	innerRadius: number,
	steps = 48
): Feature {
	const earthRadius = 6371000;
	const makeRing = (r: number): [number, number][] => {
		const coords: [number, number][] = [];
		for (let i = 0; i <= steps; i++) {
			const angle = (i / steps) * 2 * Math.PI;
			const dLat = (r * Math.cos(angle)) / earthRadius;
			const dLng = (r * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
			coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
		}
		return coords;
	};
	const outer = makeRing(outerRadius);
	const coordinates: [number, number][][] = [outer];
	if (innerRadius > 0) {
		coordinates.push(makeRing(innerRadius).reverse());
	}
	return {
		type: 'Feature',
		properties: {},
		geometry: { type: 'Polygon', coordinates }
	};
}

/**
 * Build heading cone SVG for GPS direction indicator.
 */
export function buildConeSVG(heading: number): string {
	const size = 80;
	const half = size / 2;
	const coneLength = 34;
	const coneSpread = 28;
	const rad1 = ((heading - coneSpread) * Math.PI) / 180;
	const rad2 = ((heading + coneSpread) * Math.PI) / 180;
	const x1 = half + coneLength * Math.sin(rad1);
	const y1 = half - coneLength * Math.cos(rad1);
	const x2 = half + coneLength * Math.sin(rad2);
	const y2 = half - coneLength * Math.cos(rad2);
	const coneColor = resolveThemeColor('--primary', '#4a9eff');
	return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
		<defs><radialGradient id="hc" cx="50%" cy="50%" r="50%">
			<stop offset="0%" stop-color="${coneColor}" stop-opacity="0.5"/>
			<stop offset="100%" stop-color="${coneColor}" stop-opacity="0"/>
		</radialGradient></defs>
		<path d="M ${half} ${half} L ${x1} ${y1} A ${coneLength} ${coneLength} 0 0 1 ${x2} ${y2} Z" fill="url(#hc)"/>
	</svg>`;
}

/**
 * Cell tower radio type → color (resolved from chart CSS variables).
 */
export function getRadioColor(radio: string): string {
	switch (radio?.toUpperCase()) {
		case 'LTE':
			return resolveThemeColor('--chart-1', '#4a9eff');
		case 'NR':
			return resolveThemeColor('--chart-5', '#ec4899');
		case 'UMTS':
			return resolveThemeColor('--chart-2', '#10b981');
		case 'GSM':
			return resolveThemeColor('--chart-3', '#f97316');
		case 'CDMA':
			return resolveThemeColor('--chart-4', '#8b5cf6');
		default:
			return resolveThemeColor('--muted-foreground', '#9aa0a6');
	}
}

/**
 * Haversine distance in km between two coordinate pairs.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a timestamp as a relative time string (e.g., "5m ago").
 */
export function formatTimeAgo(timestamp: number): string {
	if (!timestamp) return '—';
	const now = Date.now();
	const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
	const diff = Math.max(0, now - ts);
	const secs = Math.floor(diff / 1000);
	if (secs < 60) return `${secs}s ago`;
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Format a frequency value (e.g., 5240000 KHz → "5.24 GHz").
 */
export function formatFrequency(freq: number): string {
	if (!freq) return '—';
	if (freq >= 1000000) return `${(freq / 1000000).toFixed(2)} GHz`;
	if (freq >= 1000) return `${(freq / 1000).toFixed(0)} MHz`;
	return `${freq} MHz`;
}

/**
 * Layer visibility — maps toggle keys to MapLibre layer IDs.
 */
export const LAYER_MAP: Record<string, string[]> = {
	deviceDots: ['device-clusters', 'device-cluster-count', 'device-circles'],
	connectionLines: ['device-connection-lines'],
	cellTowers: ['cell-tower-circles', 'cell-tower-labels'],
	signalMarkers: ['detection-range-fill'],
	accuracyCircle: ['accuracy-fill']
};

/**
 * Fetch nearby cell towers from API.
 */
export async function fetchCellTowers(lat: number, lon: number): Promise<FeatureCollection | null> {
	try {
		const res = await fetch(`/api/cell-towers/nearby?lat=${lat}&lon=${lon}&radius=5`);
		if (!res.ok) return null;
		const data = await res.json();
		if (!data.success || !data.towers?.length) return null;

		const features: Feature[] = data.towers.map(
			(t: {
				radio: string;
				mcc: number;
				mnc: number;
				lac: number;
				ci: number;
				lat: number;
				lon: number;
				range: number;
				samples: number;
				avgSignal: number;
			}) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
				properties: {
					radio: t.radio,
					mcc: t.mcc,
					mnc: t.mnc,
					lac: t.lac,
					ci: t.ci,
					range: t.range,
					samples: t.samples,
					avgSignal: t.avgSignal,
					color: getRadioColor(t.radio)
				}
			})
		);

		return { type: 'FeatureCollection', features };
	} catch (_error: unknown) {
		return null;
	}
}
