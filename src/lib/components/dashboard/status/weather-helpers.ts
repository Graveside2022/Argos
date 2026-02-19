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

export function getWeatherIcon(code: number, isDay: boolean): string {
	if (code <= 1) {
		if (isDay)
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
	}
	if (code <= 3)
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
	if (code >= 45 && code <= 48)
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/></svg>`;
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`;
	if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`;
	if (code >= 95)
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`;
	return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
}

export function getWeatherCondition(code: number): string {
	if (code === 0) return 'Clear sky';
	if (code === 1) return 'Mainly clear';
	if (code === 2) return 'Partly cloudy';
	if (code === 3) return 'Overcast';
	if (code >= 45 && code <= 48) return 'Fog';
	if (code >= 51 && code <= 55) return 'Drizzle';
	if (code >= 56 && code <= 57) return 'Freezing drizzle';
	if (code >= 61 && code <= 65) return 'Rain';
	if (code >= 66 && code <= 67) return 'Freezing rain';
	if (code >= 71 && code <= 75) return 'Snowfall';
	if (code === 77) return 'Snow grains';
	if (code >= 80 && code <= 82) return 'Rain showers';
	if (code >= 85 && code <= 86) return 'Snow showers';
	if (code >= 95) return 'Thunderstorm';
	return 'Unknown';
}

export function getRfConditions(w: WeatherData): { label: string; cls: string } {
	if (w.precipitation > 5 || w.humidity > 95) return { label: 'Degraded', cls: 'warn' };
	if (w.precipitation > 0 || w.humidity > 80) return { label: 'Fair', cls: '' };
	return { label: 'Good', cls: 'accent' };
}

export function getFlightConditions(w: WeatherData): { label: string; cls: string } {
	if (w.windGusts > 40 || w.precipitation > 2) return { label: 'No-Go', cls: 'warn' };
	if (w.windGusts > 25 || w.windSpeed > 20 || w.precipitation > 0)
		return { label: 'Caution', cls: '' };
	return { label: 'Good', cls: 'accent' };
}
