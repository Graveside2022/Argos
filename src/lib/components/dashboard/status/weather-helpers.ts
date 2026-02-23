/**
 * Weather utility functions — icon SVGs, condition labels, RF/flight assessment.
 * Extracted from TopStatusBar to keep the orchestrator focused on layout.
 */

export interface WeatherData {
	temperature: number;
	apparentTemperature: number;
	humidity: number;
	windSpeed: number;
	windGusts: number;
	precipitation: number;
	pressure: number;
	weatherCode: number;
	isDay: boolean;
}

const SVG_SUN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const SVG_MOON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SVG_CLOUD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
const SVG_FOG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/></svg>`;
const SVG_RAIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`;
const SVG_SNOW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`;
const SVG_THUNDER = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`;

/** Range-based icon lookup: [minCode, maxCode, svg]. Matched top-to-bottom, first match wins. */
const ICON_RANGES: [number, number, string][] = [
	[95, 999, SVG_THUNDER],
	[85, 86, SVG_SNOW],
	[80, 82, SVG_RAIN],
	[71, 77, SVG_SNOW],
	[51, 67, SVG_RAIN],
	[45, 48, SVG_FOG],
	[2, 3, SVG_CLOUD]
];

/** Resolve weather icon for clear/near-clear codes (0-1). */
function clearIcon(isDay: boolean): string {
	return isDay ? SVG_SUN : SVG_MOON;
}

export function getWeatherIcon(code: number, isDay: boolean): string {
	if (code <= 1) return clearIcon(isDay);
	const match = ICON_RANGES.find(([min, max]) => code >= min && code <= max);
	return match ? match[2] : SVG_CLOUD;
}

/** Range-based condition lookup: [minCode, maxCode, label]. */
const CONDITION_RANGES: [number, number, string][] = [
	[95, 999, 'Thunderstorm'],
	[85, 86, 'Snow showers'],
	[80, 82, 'Rain showers'],
	[77, 77, 'Snow grains'],
	[71, 75, 'Snowfall'],
	[66, 67, 'Freezing rain'],
	[61, 65, 'Rain'],
	[56, 57, 'Freezing drizzle'],
	[51, 55, 'Drizzle'],
	[45, 48, 'Fog'],
	[3, 3, 'Overcast'],
	[2, 2, 'Partly cloudy'],
	[1, 1, 'Mainly clear'],
	[0, 0, 'Clear sky']
];

export function getWeatherCondition(code: number): string {
	const match = CONDITION_RANGES.find(([min, max]) => code >= min && code <= max);
	return match ? match[2] : 'Unknown';
}

export function getRfConditions(w: WeatherData): { label: string; cls: string } {
	if (w.precipitation > 5 || w.humidity > 95) return { label: 'Degraded', cls: 'warn' };
	if (w.precipitation > 0 || w.humidity > 80) return { label: 'Fair', cls: '' };
	return { label: 'Good', cls: 'accent' };
}

/** Check if flight conditions are dangerous. */
function isFlightNoGo(w: WeatherData): boolean {
	return w.windGusts > 40 || w.precipitation > 2;
}

/** Check if flight conditions warrant caution. */
function isFlightCaution(w: WeatherData): boolean {
	return w.windGusts > 25 || w.windSpeed > 20 || w.precipitation > 0;
}

export function getFlightConditions(w: WeatherData): { label: string; cls: string } {
	if (isFlightNoGo(w)) return { label: 'No-Go', cls: 'warn' };
	if (isFlightCaution(w)) return { label: 'Caution', cls: '' };
	return { label: 'Good', cls: 'accent' };
}
