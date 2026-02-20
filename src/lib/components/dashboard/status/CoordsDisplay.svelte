<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
<script lang="ts">
	import { getWeatherIcon, type WeatherData } from './weather-helpers';
	import WeatherDropdown from './WeatherDropdown.svelte';

	interface Props {
		locationName: string;
		weather: WeatherData | null;
		gpsCoords: { lat: string; lon: string; mgrs: string };
		zuluTime: string;
		weatherOpen: boolean;
		onToggleWeather: () => void;
	}

	let { locationName, weather, gpsCoords, zuluTime, weatherOpen, onToggleWeather }: Props =
		$props();
</script>

<div class="coords-group">
	{#if locationName}<span class="coord-value location-name">{locationName}</span><span
			class="coord-sep">|</span
		>{/if}
	{#if weather}
		<div class="device-wrapper weather-wrapper">
			<div
				class="weather-chip device-btn"
				onclick={onToggleWeather}
				role="button"
				tabindex="0"
			>
				<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
				<span class="weather-icon"
					>{@html getWeatherIcon(weather.weatherCode, weather.isDay)}</span
				>
				<span class="coord-value">{Math.round(weather.temperature)}°C</span>
			</div>
			{#if weatherOpen}<WeatherDropdown {weather} />{/if}
		</div>
		<span class="coord-sep">|</span>
	{/if}
	{#if gpsCoords.lat}
		<span class="coord-value">{gpsCoords.lat}</span><span class="coord-sep">/</span>
		<span class="coord-value">{gpsCoords.lon}</span><span class="coord-sep">|</span>
		<span class="coord-value">{gpsCoords.mgrs}</span><span class="coord-sep">|</span>
	{/if}
	<span class="coord-value time-value">{zuluTime}</span>
</div>

<style>
	.coords-group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		overflow: visible;
		white-space: nowrap;
	}
	.coord-value {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--palantir-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.coord-sep {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
	}
	.location-name {
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-widest);
	}
	.device-wrapper {
		position: relative;
	}
	.weather-wrapper {
		display: flex;
		align-items: center;
	}
	.weather-chip {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
	}
	.weather-chip:hover {
		background: var(--palantir-bg-hover);
	}
	.weather-icon {
		display: flex;
		align-items: center;
		color: var(--palantir-text-secondary);
	}
	.time-value {
		letter-spacing: 0.08em;
	}

	@media (max-width: 1023px) {
		.weather-wrapper,
		.weather-wrapper + .coord-sep {
			display: none;
		}
	}
	@media (max-width: 767px) {
		.location-name,
		.location-name + .coord-sep {
			display: none;
		}
		.coords-group span:nth-child(7),
		.coords-group span:nth-child(8) {
			display: none;
		}
		.coord-value {
			font-size: 11px;
		}
	}
	@media (max-width: 599px) {
		.coords-group {
			font-size: 10px;
			gap: var(--space-1);
		}
		.time-value {
			display: none;
		}
	}
	@media (max-width: 479px) {
		.coords-group {
			display: none;
		}
	}
</style>
