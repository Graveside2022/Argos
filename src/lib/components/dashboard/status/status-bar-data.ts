/**
 * Data fetching functions for TopStatusBar — hardware status, details, weather, geocoding, satellites.
 * Extracted from TopStatusBar to separate data concerns from presentation.
 */
import type { Satellite } from '$lib/gps/types';

import type { WeatherData } from './weather-helpers';

export interface WifiInfo {
	interface?: string;
	monitorInterface?: string;
	mac?: string;
	driver?: string;
	chipset?: string;
	mode?: string;
	channel?: string;
	bands?: string[];
	owner?: string;
}

export interface SdrInfo {
	serial?: string;
	product?: string;
	manufacturer?: string;
	firmwareApi?: string;
	usbSpeed?: string;
	maxPower?: string;
	configuration?: string;
	owner?: string;
}

export interface GpsInfo {
	device?: string;
	protocol?: string;
	baudRate?: number;
	usbAdapter?: string;
	gpsdVersion?: string;
}

export type DeviceState = 'active' | 'standby' | 'offline';

export interface HardwareStatusResult {
	wifiState: DeviceState;
	wifiOwner?: string;
	sdrState: DeviceState;
	sdrOwner?: string;
}

/** Determine device state from detection and ownership. */
function resolveDeviceState(hw: { isDetected?: boolean; owner?: string }): DeviceState {
	if (!hw?.isDetected) return 'offline';
	return hw.owner ? 'active' : 'standby';
}

/** Build hardware status result from API response. */
function buildHardwareResult(
	status: Record<string, Record<string, unknown>>
): HardwareStatusResult {
	return {
		wifiState: resolveDeviceState(status.alfa),
		wifiOwner: status.alfa?.owner as string | undefined,
		sdrState: resolveDeviceState(status.hackrf),
		sdrOwner: status.hackrf?.owner as string | undefined
	};
}

export async function fetchHardwareStatus(): Promise<HardwareStatusResult | null> {
	try {
		const res = await fetch('/api/hardware/status');
		if (!res.ok) return null;
		return buildHardwareResult(await res.json());
	} catch {
		return null;
	}
}

export interface HardwareDetailsResult {
	wifi?: Partial<WifiInfo>;
	sdr?: Partial<SdrInfo>;
	gps?: Partial<GpsInfo>;
}

export async function fetchHardwareDetails(): Promise<HardwareDetailsResult | null> {
	try {
		const res = await fetch('/api/hardware/details');
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/** Haversine distance in meters between two lat/lon points. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371000;
	const dLat = ((lat1 - lat2) * Math.PI) / 180;
	const dLon = ((lon1 - lon2) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat2 * Math.PI) / 180) *
			Math.cos((lat1 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Map API weather response to WeatherData, returning null on error responses. */
function mapWeatherResponse(data: Record<string, unknown>): WeatherData | null {
	if (data.error) return null;
	return {
		temperature: data.temperature_2m as number,
		apparentTemperature: data.apparent_temperature as number,
		humidity: data.relative_humidity_2m as number,
		windSpeed: data.wind_speed_10m as number,
		windGusts: data.wind_gusts_10m as number,
		precipitation: data.precipitation as number,
		pressure: data.pressure_msl as number,
		weatherCode: data.weather_code as number,
		isDay: data.is_day === 1
	};
}

/** Check if position has moved enough to warrant a new fetch. */
function hasMoved(
	lat: number,
	lon: number,
	lastLat: number,
	lastLon: number,
	thresholdMeters: number
): boolean {
	return haversineMeters(lat, lon, lastLat, lastLon) >= thresholdMeters;
}

export async function fetchWeather(
	lat: number,
	lon: number,
	lastLat: number,
	lastLon: number,
	hasExistingData: boolean
): Promise<WeatherData | null> {
	if (hasExistingData && !hasMoved(lat, lon, lastLat, lastLon, 1000)) return null;

	try {
		const res = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
		if (!res.ok) return null;
		const data = await res.json();
		return mapWeatherResponse(data);
	} catch {
		return null;
	}
}

/** Extract location name from geocode API response. */
function extractLocationName(data: Record<string, unknown>): string | null {
	return data.success && data.locationName ? (data.locationName as string) : null;
}

export async function reverseGeocode(
	lat: number,
	lon: number,
	lastLat: number,
	lastLon: number,
	hasExistingName: boolean
): Promise<string | null> {
	if (hasExistingName && !hasMoved(lat, lon, lastLat, lastLon, 500)) return null;

	try {
		const res = await fetch(`/api/gps/location?lat=${lat}&lon=${lon}`);
		if (!res.ok) return null;
		return extractLocationName(await res.json());
	} catch {
		return null;
	}
}

export async function fetchSatelliteData(): Promise<{
	satellites: Satellite[];
	usedCount: number;
} | null> {
	try {
		const res = await fetch('/api/gps/satellites');
		if (!res.ok) return null;
		const data = await res.json();
		if (!data.success || !data.satellites) return null;
		return {
			satellites: data.satellites,
			usedCount: data.satellites.filter((s: Satellite) => s.used).length
		};
	} catch {
		return null;
	}
}

export function formatSerial(s: string): string {
	const trimmed = s.replace(/^0+/, '');
	return trimmed.length > 12 ? '...' + trimmed.slice(-12) : trimmed;
}
