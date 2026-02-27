/**
 * Viewshed parameter memoization — tracks last-fetched values to skip redundant API calls.
 *
 * IMPORTANT: This file is intentionally a plain .ts (NOT .svelte.ts) because
 * Svelte 5's compiler transforms !== into $.strict_equals() inside .svelte.ts
 * files, which inverts the boolean logic and breaks change detection.
 */
import { haversineMeters } from '$lib/utils/geo';

const POSITION_DELTA_M = 50;

/** What kind of change was detected */
export type ChangeKind = 'none' | 'opacity' | 'terrain';

export class ParamsMemo {
	private lat = Infinity;
	private lon = Infinity;
	private heightAgl = 0;
	private radiusM = 0;
	private greenOp = 0;
	private redOp = 0;
	private gpsMslAlt: number | undefined = undefined;

	/**
	 * Check what kind of change occurred.
	 * Returns 'terrain' for position/height/radius/gpsAltitude changes (expensive re-computation),
	 * 'opacity' for opacity-only changes (fast server-side re-encode),
	 * 'none' if nothing changed.
	 */
	classifyChange(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number,
		gpsMslAlt?: number
	): ChangeKind {
		if (this.hasTerrainChange(lat, lon, heightAgl, radiusM, gpsMslAlt)) return 'terrain';
		if (greenOp !== this.greenOp || redOp !== this.redOp) return 'opacity';
		return 'none';
	}

	private hasTerrainChange(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		gpsMslAlt?: number
	): boolean {
		const posDelta = haversineMeters(this.lat, this.lon, lat, lon);
		return (
			posDelta >= POSITION_DELTA_M ||
			heightAgl !== this.heightAgl ||
			radiusM !== this.radiusM ||
			gpsMslAlt !== this.gpsMslAlt
		);
	}

	save(
		lat: number,
		lon: number,
		heightAgl: number,
		radiusM: number,
		greenOp: number,
		redOp: number,
		gpsMslAlt?: number
	): void {
		this.lat = lat;
		this.lon = lon;
		this.heightAgl = heightAgl;
		this.radiusM = radiusM;
		this.greenOp = greenOp;
		this.redOp = redOp;
		this.gpsMslAlt = gpsMslAlt;
	}
}
