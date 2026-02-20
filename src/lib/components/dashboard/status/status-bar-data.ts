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

export async function fetchHardwareStatus(): Promise<HardwareStatusResult | null> {
	try {
		const res = await fetch('/api/hardware/status');
		if (!res.ok) return null;
		const status = await res.json();
		const alfa = status.alfa;
		const hackrf = status.hackrf;
		return {
			wifiState: alfa?.isDetected ? (alfa.owner ? 'active' : 'standby') : 'offline',
			wifiOwner: alfa?.owner || undefined,
			sdrState: hackrf?.isDetected ? (hackrf.owner ? 'active' : 'standby') : 'offline',
			sdrOwner: hackrf?.owner || undefined
		};
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

export async function fetchWeather(
	lat: number,
	lon: number,
	lastLat: number,
	lastLon: number,
	hasExistingData: boolean
): Promise<WeatherData | null> {
	if (hasExistingData) {
		const R = 6371000;
		const dLat = ((lat - lastLat) * Math.PI) / 180;
		const dLon = ((lon - lastLon) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos((lastLat * Math.PI) / 180) *
				Math.cos((lat * Math.PI) / 180) *
				Math.sin(dLon / 2) ** 2;
		const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		if (dist < 1000) return null;
	}

	try {
		const res = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
		if (!res.ok) return null;
		const data = await res.json();
		if (data.error) return null;
		return {
			temperature: data.temperature_2m,
			apparentTemperature: data.apparent_temperature,
			humidity: data.relative_humidity_2m,
			windSpeed: data.wind_speed_10m,
			windGusts: data.wind_gusts_10m,
			precipitation: data.precipitation,
			pressure: data.pressure_msl,
			weatherCode: data.weather_code,
			isDay: data.is_day === 1
		};
	} catch {
		return null;
	}
}

export async function reverseGeocode(
	lat: number,
	lon: number,
	lastLat: number,
	lastLon: number,
	hasExistingName: boolean
): Promise<string | null> {
	const R = 6371000;
	const dLat = ((lat - lastLat) * Math.PI) / 180;
	const dLon = ((lon - lastLon) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lastLat * Math.PI) / 180) *
			Math.cos((lat * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	if (hasExistingName && dist < 500) return null;

	try {
		const res = await fetch(`/api/gps/location?lat=${lat}&lon=${lon}`);
		if (!res.ok) return null;
		const data = await res.json();
		return data.success && data.locationName ? data.locationName : null;
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
