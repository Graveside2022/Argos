<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
<script lang="ts">
	import {
		getFlightConditions,
		getRfConditions,
		getWeatherCondition,
		type WeatherData
	} from './weather-helpers';

	interface Props {
		weather: WeatherData;
	}

	let { weather }: Props = $props();
</script>

<div class="device-dropdown weather-dropdown">
	<div class="dropdown-title">WEATHER CONDITIONS</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Condition</span><span class="dropdown-val"
			>{getWeatherCondition(weather.weatherCode)}</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Temperature</span><span class="dropdown-val"
			>{weather.temperature.toFixed(1)}°C</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Feels Like</span><span class="dropdown-val"
			>{weather.apparentTemperature.toFixed(1)}°C</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Humidity</span><span class="dropdown-val"
			>{weather.humidity}%</span
		>
	</div>
	<div class="dropdown-divider"></div>
	<div class="dropdown-row">
		<span class="dropdown-key">Wind</span><span class="dropdown-val"
			>{weather.windSpeed.toFixed(0)} km/h</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Gusts</span><span class="dropdown-val"
			>{weather.windGusts.toFixed(0)} km/h</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Precipitation</span><span class="dropdown-val"
			>{weather.precipitation.toFixed(1)} mm</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Pressure</span><span class="dropdown-val"
			>{weather.pressure.toFixed(0)} hPa</span
		>
	</div>
	<div class="dropdown-divider"></div>
	<div class="dropdown-row">
		<span class="dropdown-key">RF Conditions</span><span
			class="dropdown-val"
			class:accent={getRfConditions(weather).cls === 'accent'}
			class:warn={getRfConditions(weather).cls === 'warn'}
			>{getRfConditions(weather).label}</span
		>
	</div>
	<div class="dropdown-row">
		<span class="dropdown-key">Flight Conditions</span><span
			class="dropdown-val"
			class:accent={getFlightConditions(weather).cls === 'accent'}
			class:warn={getFlightConditions(weather).cls === 'warn'}
			>{getFlightConditions(weather).label}</span
		>
	</div>
</div>

<style>
	.device-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 260px;
		background: var(--palantir-bg-panel);
		border: 1px solid var(--palantir-border-default);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.weather-dropdown {
		right: 0;
		left: auto;
	}

	.dropdown-title {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
		padding-bottom: var(--space-1);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.dropdown-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.dropdown-key {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		white-space: nowrap;
	}

	.dropdown-val {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		text-align: right;
	}

	.dropdown-val.accent {
		color: var(--palantir-success);
	}

	.dropdown-val.warn {
		color: var(--palantir-error);
	}

	.dropdown-divider {
		height: 1px;
		background: var(--palantir-border-subtle);
		margin: var(--space-1) 0;
	}
</style>
