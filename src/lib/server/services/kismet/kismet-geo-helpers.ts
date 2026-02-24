/**
 * Kismet Geographic Helpers
 * Shared FNV-1a MAC hashing and GPS offset functions for deterministic device placement.
 */

import { GEO } from '$lib/constants/limits';

/**
 * FNV-1a 32-bit hash of a MAC address, normalized to [0, 1).
 * Deterministic: same MAC always produces the same value.
 */
export function hashMAC(mac: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x01000193) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/** Second independent hash for the same MAC (different seed) → [0, 1). */
export function hashMAC2(mac: string): number {
	let hash = 0x01000193;
	for (let i = 0; i < mac.length; i++) {
		hash ^= mac.charCodeAt(i);
		hash = (hash * 0x811c9dc5) | 0;
	}
	return ((hash >>> 0) % 100000) / 100000;
}

/** Compute deterministic distance from signal strength and MAC hash. */
export function signalToDistance(signalDbm: number, mac: string): number {
	const quantized = Math.round(signalDbm / 10) * 10;
	const clamped = Math.max(-100, Math.min(-20, quantized));
	const signalNorm = (clamped + 100) / 80;
	const variation = hashMAC2(mac) * 0.3;
	const baseDist = 20 + (1 - signalNorm) * 180;
	return baseDist * (0.85 + variation);
}

/** Offset GPS position by angle and distance (haversine approximation). */
export function offsetGps(
	baseLat: number,
	baseLon: number,
	angle: number,
	dist: number
): { lat: number; lon: number } {
	const R = GEO.EARTH_RADIUS_M;
	const dLat = ((dist * Math.cos(angle)) / R) * (180 / Math.PI);
	const dLon =
		((dist * Math.sin(angle)) / (R * Math.cos((baseLat * Math.PI) / 180))) * (180 / Math.PI);
	return { lat: baseLat + dLat, lon: baseLon + dLon };
}

/** Compute fallback lat/lon from GPS base + MAC hash + signal distance. */
export function computeFallbackLocation(
	gps: { lat: number; lon: number },
	mac: string,
	signalDbm: number
): { lat: number; lon: number } {
	const angle = hashMAC(mac) * 2 * Math.PI;
	const dist = signalToDistance(signalDbm, mac);
	return offsetGps(gps.lat, gps.lon, angle, dist);
}
