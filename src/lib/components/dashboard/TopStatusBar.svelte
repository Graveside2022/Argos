<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#999 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { onMount } from 'svelte';

	import TAKIndicator from '$lib/components/status/TAKIndicator.svelte';
	import type { Satellite } from '$lib/gps/types';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';

	import {
		type DeviceState,
		fetchHardwareDetails,
		fetchHardwareStatus,
		fetchSatelliteData,
		fetchWeather,
		formatSerial,
		type GpsInfo,
		reverseGeocode,
		type SdrInfo,
		type WifiInfo
	} from './status/status-bar-data';
	import { getWeatherIcon, type WeatherData } from './status/weather-helpers';
	import WeatherDropdown from './status/WeatherDropdown.svelte';

	let wifiState: DeviceState = $state('offline');
	let sdrState: DeviceState = $state('offline');
	let gpsState: DeviceState = $state('offline');

	let wifiInfo: WifiInfo = $state({});
	let sdrInfo: SdrInfo = $state({});
	let gpsInfo: GpsInfo = $state({});

	let gpsSats = $state(0);
	let gpsCoords = $state({ lat: '', lon: '', mgrs: '' });
	let gpsSpeed: number | null = $state(null);
	let gpsAccuracy: number | null = $state(null);
	let gpsFix = $state(0);
	let zuluTime = $state('');
	let locationName = $state('');
	let lastGeocodeLat = 0;
	let lastGeocodeLon = 0;
	let openDropdown: 'wifi' | 'sdr' | 'gps' | 'weather' | null = $state(null);

	let satellitesExpanded = $state(false);
	let satelliteData = $state<Satellite[]>([]);
	let satelliteUsedCount = $state(0);

	let weather: WeatherData | null = $state(null);
	let lastWeatherLat = 0;
	let lastWeatherLon = 0;
	let currentGpsLat = 0;
	let currentGpsLon = 0;

	function updateClock() {
		const now = new Date();
		zuluTime = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
	}
	updateClock();

	function toggleDropdown(which: 'wifi' | 'sdr' | 'gps' | 'weather') {
		openDropdown = openDropdown === which ? null : which;
	}

	$effect(() => {
		const gps = $gpsStore;
		const s = gps.status;
		if (s.hasGPSFix) {
			gpsState = 'active';
			gpsSats = s.satellites;
			gpsCoords = {
				lat: s.formattedCoords.lat,
				lon: s.formattedCoords.lon,
				mgrs: s.mgrsCoord
			};
			gpsSpeed = s.speed;
			gpsAccuracy = s.accuracy || null;
			gpsFix = s.fixType === '3D' ? 3 : s.fixType === '2D' ? 2 : 0;
			currentGpsLat = gps.position.lat;
			currentGpsLon = gps.position.lon;
			void reverseGeocode(
				gps.position.lat,
				gps.position.lon,
				lastGeocodeLat,
				lastGeocodeLon,
				!!locationName
			).then((name) => {
				if (name) {
					locationName = name;
					lastGeocodeLat = gps.position.lat;
					lastGeocodeLon = gps.position.lon;
				}
			});
			void fetchWeather(
				gps.position.lat,
				gps.position.lon,
				lastWeatherLat,
				lastWeatherLon,
				!!weather
			).then((w) => {
				if (w) {
					weather = w;
					lastWeatherLat = gps.position.lat;
					lastWeatherLon = gps.position.lon;
				}
			});
		} else if (s.gpsStatus.includes('Error')) {
			gpsState = 'offline';
			gpsSats = 0;
			gpsCoords = { lat: '', lon: '', mgrs: '' };
			gpsSpeed = null;
			gpsAccuracy = null;
			gpsFix = 0;
		} else {
			gpsState = 'standby';
			gpsSats = 0;
			gpsCoords = { lat: '', lon: '', mgrs: '' };
			gpsSpeed = null;
			gpsAccuracy = null;
			gpsFix = 0;
		}
	});

	$effect(() => {
		if (openDropdown === 'gps' && satellitesExpanded) {
			void fetchSatelliteData().then((r) => {
				if (r) {
					satelliteData = r.satellites;
					satelliteUsedCount = r.usedCount;
				}
			});
			const interval = setInterval(
				() =>
					void fetchSatelliteData().then((r) => {
						if (r) {
							satelliteData = r.satellites;
							satelliteUsedCount = r.usedCount;
						}
					}),
				5000
			);
			return () => clearInterval(interval);
		}
	});

	onMount(() => {
		void fetchHardwareStatus().then((r) => {
			if (r) {
				wifiState = r.wifiState;
				sdrState = r.sdrState;
				wifiInfo = { ...wifiInfo, owner: r.wifiOwner };
				sdrInfo = { ...sdrInfo, owner: r.sdrOwner };
			}
		});
		void fetchHardwareDetails().then((d) => {
			if (d?.wifi) wifiInfo = { ...wifiInfo, ...d.wifi };
			if (d?.sdr) sdrInfo = { ...sdrInfo, ...d.sdr };
			if (d?.gps) gpsInfo = { ...d.gps };
		});
		const statusInterval = setInterval(
			() =>
				void fetchHardwareStatus().then((r) => {
					if (r) {
						wifiState = r.wifiState;
						sdrState = r.sdrState;
						wifiInfo = { ...wifiInfo, owner: r.wifiOwner };
						sdrInfo = { ...sdrInfo, owner: r.sdrOwner };
					}
				}),
			5000
		);
		const clockInterval = setInterval(updateClock, 1000);
		const weatherInterval = setInterval(() => {
			if (currentGpsLat && currentGpsLon) {
				lastWeatherLat = 0;
				lastWeatherLon = 0;
				void fetchWeather(currentGpsLat, currentGpsLon, 0, 0, false).then((w) => {
					if (w) {
						weather = w;
						lastWeatherLat = currentGpsLat;
						lastWeatherLon = currentGpsLon;
					}
				});
			}
		}, 600000);
		return () => {
			clearInterval(statusInterval);
			clearInterval(clockInterval);
			clearInterval(weatherInterval);
		};
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="top-status-bar"
	onclick={(e) => {
		if (e.target === e.currentTarget) openDropdown = null;
	}}
>
	<div class="status-group">
		<span class="app-brand">ARGOS</span>
		<span class="status-divider"></span>

		<!-- WiFi -->
		<div class="device-wrapper">
			<div
				class="status-item device-btn"
				onclick={() => toggleDropdown('wifi')}
				role="button"
				tabindex="0"
			>
				<span
					class="status-dot"
					class:dot-active={wifiState === 'active'}
					class:dot-standby={wifiState === 'standby'}
					class:dot-offline={wifiState === 'offline'}
				></span>
				<span class="status-label">WiFi Adapter</span>
			</div>
			{#if openDropdown === 'wifi'}
				<div class="device-dropdown">
					<div class="dropdown-title">WIFI ADAPTER</div>
					{#if wifiState === 'offline'}
						<div class="dropdown-row">
							<span class="dropdown-key">Status</span><span class="dropdown-val dim"
								>Not detected</span
							>
						</div>
					{:else}
						{#if wifiInfo.chipset}<div class="dropdown-row">
								<span class="dropdown-key">Chipset</span><span class="dropdown-val"
									>{wifiInfo.chipset}</span
								>
							</div>{/if}
						{#if wifiInfo.mac}<div class="dropdown-row">
								<span class="dropdown-key">MAC</span><span class="dropdown-val"
									>{wifiInfo.mac}</span
								>
							</div>{/if}
						{#if wifiInfo.driver}<div class="dropdown-row">
								<span class="dropdown-key">Driver</span><span class="dropdown-val"
									>{wifiInfo.driver}</span
								>
							</div>{/if}
						<div class="dropdown-row">
							<span class="dropdown-key">Interface</span><span class="dropdown-val"
								>{wifiInfo.monitorInterface || wifiInfo.interface || '—'}</span
							>
						</div>
						{#if wifiInfo.mode}<div class="dropdown-row">
								<span class="dropdown-key">Mode</span><span class="dropdown-val"
									>{wifiInfo.mode}</span
								>
							</div>{/if}
						{#if wifiInfo.channel}<div class="dropdown-row">
								<span class="dropdown-key">Channel</span><span class="dropdown-val"
									>{wifiInfo.channel}</span
								>
							</div>{/if}
						{#if wifiInfo.bands && wifiInfo.bands.length > 0}<div class="dropdown-row">
								<span class="dropdown-key">Bands</span><span class="dropdown-val"
									>{wifiInfo.bands.join(', ')}</span
								>
							</div>{/if}
						{#if wifiInfo.owner}<div class="dropdown-row">
								<span class="dropdown-key">Used by</span><span
									class="dropdown-val accent">{wifiInfo.owner}</span
								>
							</div>{/if}
					{/if}
				</div>
			{/if}
		</div>

		<!-- SDR -->
		<div class="device-wrapper">
			<div
				class="status-item device-btn"
				onclick={() => toggleDropdown('sdr')}
				role="button"
				tabindex="0"
			>
				<span
					class="status-dot"
					class:dot-active={sdrState === 'active'}
					class:dot-standby={sdrState === 'standby'}
					class:dot-offline={sdrState === 'offline'}
				></span>
				<span class="status-label">Software Defined Radio</span>
			</div>
			{#if openDropdown === 'sdr'}
				<div class="device-dropdown">
					<div class="dropdown-title">SOFTWARE DEFINED RADIO</div>
					{#if sdrState === 'offline'}
						<div class="dropdown-row">
							<span class="dropdown-key">Status</span><span class="dropdown-val dim"
								>Not detected</span
							>
						</div>
					{:else}
						{#if sdrInfo.manufacturer}<div class="dropdown-row">
								<span class="dropdown-key">Make</span><span class="dropdown-val"
									>{sdrInfo.manufacturer}</span
								>
							</div>{/if}
						{#if sdrInfo.product}<div class="dropdown-row">
								<span class="dropdown-key">Model</span><span class="dropdown-val"
									>{sdrInfo.product}</span
								>
							</div>{/if}
						{#if sdrInfo.serial}<div class="dropdown-row">
								<span class="dropdown-key">Serial</span><span class="dropdown-val"
									>{formatSerial(sdrInfo.serial)}</span
								>
							</div>{/if}
						{#if sdrInfo.firmwareApi}<div class="dropdown-row">
								<span class="dropdown-key">FW API</span><span class="dropdown-val"
									>{sdrInfo.firmwareApi}</span
								>
							</div>{/if}
						{#if sdrInfo.usbSpeed}<div class="dropdown-row">
								<span class="dropdown-key">USB</span><span class="dropdown-val"
									>{sdrInfo.usbSpeed}</span
								>
							</div>{/if}
						{#if sdrInfo.maxPower}<div class="dropdown-row">
								<span class="dropdown-key">Power</span><span class="dropdown-val"
									>{sdrInfo.maxPower}</span
								>
							</div>{/if}
						{#if sdrInfo.configuration}<div class="dropdown-row">
								<span class="dropdown-key">Mode</span><span class="dropdown-val"
									>{sdrInfo.configuration}</span
								>
							</div>{/if}
						{#if sdrInfo.owner}<div class="dropdown-row">
								<span class="dropdown-key">Used by</span><span
									class="dropdown-val accent">{sdrInfo.owner}</span
								>
							</div>{/if}
						{#if !sdrInfo.owner}<div class="dropdown-row">
								<span class="dropdown-key">Status</span><span
									class="dropdown-val dim">Idle</span
								>
							</div>{/if}
					{/if}
				</div>
			{/if}
		</div>

		<!-- GPS -->
		<div class="device-wrapper">
			<div
				class="status-item device-btn"
				onclick={() => toggleDropdown('gps')}
				role="button"
				tabindex="0"
			>
				<span
					class="status-dot"
					class:dot-active={gpsState === 'active'}
					class:dot-standby={gpsState === 'standby'}
					class:dot-offline={gpsState === 'offline'}
				></span>
				<span class="status-label">GPS</span>
				<span class="sat-count">{gpsSats} SAT</span>
			</div>
			{#if openDropdown === 'gps'}
				<div class="device-dropdown">
					<div class="dropdown-title">GPS RECEIVER</div>
					{#if gpsState === 'offline'}
						<div class="dropdown-row">
							<span class="dropdown-key">Status</span><span class="dropdown-val dim"
								>Not available</span
							>
						</div>
					{:else}
						<div class="dropdown-row">
							<span class="dropdown-key">Fix</span><span
								class="dropdown-val"
								class:accent={gpsFix >= 2}
								>{gpsFix === 3
									? '3D Fix'
									: gpsFix === 2
										? '2D Fix'
										: 'No Fix'}</span
							>
						</div>
						<div
							class="dropdown-row satellites-toggle"
							onclick={() => (satellitesExpanded = !satellitesExpanded)}
							role="button"
							tabindex="0"
						>
							<span class="dropdown-key">Satellites</span><span class="dropdown-val"
								>{gpsSats}
								<span class="expand-icon" class:expanded={satellitesExpanded}
									>▼</span
								></span
							>
						</div>
						{#if satellitesExpanded && satelliteData.length > 0}
							<div class="satellites-list">
								{#each satelliteData as sat}
									<div class="dropdown-row satellite-item">
										<span class="dropdown-key"
											>PRN {sat.prn} ({sat.constellation})</span
										><span class="dropdown-val">{sat.snr} dB</span>
									</div>
								{/each}
								<div class="dropdown-divider"></div>
								<div class="dropdown-row">
									<span class="dropdown-key">Used for Fix</span><span
										class="dropdown-val accent">{satelliteUsedCount}</span
									>
								</div>
							</div>
						{/if}
						{#if gpsSpeed !== null}<div class="dropdown-row">
								<span class="dropdown-key">Speed</span><span class="dropdown-val"
									>{gpsSpeed.toFixed(1)} m/s</span
								>
							</div>{/if}
						{#if gpsAccuracy !== null}<div class="dropdown-row">
								<span class="dropdown-key">Accuracy</span><span class="dropdown-val"
									>{gpsAccuracy.toFixed(1)} m</span
								>
							</div>{/if}
						{#if gpsInfo.device}<div class="dropdown-divider"></div>
							<div class="dropdown-row">
								<span class="dropdown-key">Device</span><span class="dropdown-val"
									>{gpsInfo.device}</span
								>
							</div>{/if}
						{#if gpsInfo.protocol}<div class="dropdown-row">
								<span class="dropdown-key">Protocol</span><span class="dropdown-val"
									>{gpsInfo.protocol}</span
								>
							</div>{/if}
						{#if gpsInfo.baudRate}<div class="dropdown-row">
								<span class="dropdown-key">Baud</span><span class="dropdown-val"
									>{gpsInfo.baudRate}</span
								>
							</div>{/if}
						{#if gpsInfo.usbAdapter}<div class="dropdown-row">
								<span class="dropdown-key">Adapter</span><span class="dropdown-val"
									>{gpsInfo.usbAdapter}</span
								>
							</div>{/if}
						{#if gpsInfo.gpsdVersion}<div class="dropdown-row">
								<span class="dropdown-key">GPSD</span><span class="dropdown-val"
									>v{gpsInfo.gpsdVersion}</span
								>
							</div>{/if}
					{/if}
				</div>
			{/if}
		</div>

		<TAKIndicator />
	</div>

	<div class="coords-group">
		{#if locationName}<span class="coord-value location-name">{locationName}</span><span
				class="coord-sep">|</span
			>{/if}
		{#if weather}
			<div class="device-wrapper weather-wrapper">
				<div
					class="weather-chip device-btn"
					onclick={() => toggleDropdown('weather')}
					role="button"
					tabindex="0"
				>
					<!-- @constitutional-exemption Article-IX-9.4 issue:#999 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
					<span class="weather-icon"
						>{@html getWeatherIcon(weather.weatherCode, weather.isDay)}</span
					>
					<span class="coord-value">{Math.round(weather.temperature)}°C</span>
				</div>
				{#if openDropdown === 'weather'}<WeatherDropdown {weather} />{/if}
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
</div>

<style>
	.top-status-bar {
		height: var(--top-bar-height);
		min-height: var(--top-bar-height);
		background: var(--palantir-bg-chrome);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-4);
		z-index: 100;
		position: relative;
	}
	.status-group {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-shrink: 0;
	}
	.app-brand {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.14em;
		color: var(--palantir-text-primary);
	}
	.status-divider {
		width: 1px;
		height: 20px;
		background: var(--palantir-border-subtle);
	}
	.device-wrapper {
		position: relative;
	}
	.status-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--palantir-text-secondary);
	}
	.device-btn {
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
	}
	.device-btn:hover {
		background: var(--palantir-bg-hover);
	}
	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot-active {
		background: var(--palantir-success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-success) 50%, transparent);
	}
	.dot-standby {
		background: var(--palantir-warning);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-warning) 40%, transparent);
	}
	.dot-offline {
		background: var(--palantir-text-tertiary);
	}
	.status-label {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		letter-spacing: var(--letter-spacing-wide);
		white-space: nowrap;
	}
	.sat-count {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		letter-spacing: var(--letter-spacing-wide);
		margin-left: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
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
		word-break: break-all;
	}
	.dropdown-val.dim {
		color: var(--palantir-text-tertiary);
		font-style: italic;
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
	@media (max-width: 900px) {
		.status-label {
			font-size: 11px;
		}
	}
	@media (max-width: 767px) {
		.top-status-bar {
			padding: 0 var(--space-2);
		}
		.status-group {
			gap: var(--space-2);
		}
		.app-brand {
			font-size: 13px;
		}
		.status-label {
			font-size: 10px;
		}
		.sat-count {
			display: none;
		}
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
		.status-divider {
			display: none;
		}
		.status-label {
			display: none;
		}
		.coords-group {
			font-size: 10px;
			gap: var(--space-1);
		}
		.time-value {
			display: none;
		}
	}
	@media (max-width: 479px) {
		.top-status-bar {
			height: auto;
			min-height: 36px;
			flex-wrap: wrap;
			padding: var(--space-1) var(--space-2);
		}
		.app-brand {
			font-size: 12px;
		}
		.coords-group {
			display: none;
		}
		.status-dot {
			width: 10px;
			height: 10px;
		}
		.device-btn {
			padding: 8px;
			min-width: 44px;
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}

	.satellites-toggle {
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.satellites-toggle:hover {
		background: var(--palantir-bg-hover);
	}
	.expand-icon {
		display: inline-block;
		font-size: 10px;
		margin-left: var(--space-1);
		transition: transform 0.2s ease;
		color: var(--palantir-text-tertiary);
	}
	.expand-icon.expanded {
		transform: rotate(180deg);
	}
	.satellites-list {
		padding-left: var(--space-2);
		margin-top: var(--space-1);
		animation: slideDown 0.2s ease;
	}
	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 500px;
		}
	}
	.satellite-item .dropdown-key,
	.satellite-item .dropdown-val {
		font-size: 10px;
	}
</style>
