<!-- @constitutional-exemption Article-IV-4.3 issue:#999 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#999 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { onMount } from 'svelte';

	import type { Satellite } from '$lib/gps/types';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';

	type DeviceState = 'active' | 'standby' | 'offline';

	interface WifiInfo {
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

	interface SdrInfo {
		serial?: string;
		product?: string;
		manufacturer?: string;
		firmwareApi?: string;
		usbSpeed?: string;
		maxPower?: string;
		configuration?: string;
		owner?: string;
	}

	interface GpsInfo {
		device?: string;
		protocol?: string;
		baudRate?: number;
		usbAdapter?: string;
		gpsdVersion?: string;
	}

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

	// Satellite panel state
	let satellitesExpanded = $state(false);
	let satelliteData = $state<Satellite[]>([]);
	let satelliteUsedCount = $state(0);

	// Weather state
	interface WeatherData {
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

	let weather: WeatherData | null = $state(null);
	let lastWeatherLat = 0;
	let lastWeatherLon = 0;
	let currentGpsLat = 0;
	let currentGpsLon = 0;

	function updateClock() {
		const now = new Date();
		const h = String(now.getUTCHours()).padStart(2, '0');
		const m = String(now.getUTCMinutes()).padStart(2, '0');
		const s = String(now.getUTCSeconds()).padStart(2, '0');
		zuluTime = `${h}${m}${s}Z`;
	}
	updateClock();

	function toggleDropdown(which: 'wifi' | 'sdr' | 'gps' | 'weather') {
		openDropdown = openDropdown === which ? null : which;
	}

	function closeDropdown() {
		openDropdown = null;
	}

	async function reverseGeocode(lat: number, lon: number) {
		const R = 6371000;
		const dLat = ((lat - lastGeocodeLat) * Math.PI) / 180;
		const dLon = ((lon - lastGeocodeLon) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) ** 2 +
			Math.cos((lastGeocodeLat * Math.PI) / 180) *
				Math.cos((lat * Math.PI) / 180) *
				Math.sin(dLon / 2) ** 2;
		const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		if (locationName && dist < 500) return;

		try {
			// Use backend proxy to avoid CORS issues
			const res = await fetch(`/api/gps/location?lat=${lat}&lon=${lon}`);
			if (!res.ok) return;
			const data = await res.json();
			if (data.success && data.locationName) {
				locationName = data.locationName;
				lastGeocodeLat = lat;
				lastGeocodeLon = lon;
			}
		} catch (_error: unknown) {
			// Silently fail
		}
	}

	// GPS state from store
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
			void reverseGeocode(gps.position.lat, gps.position.lon);
			void fetchWeather(gps.position.lat, gps.position.lon);
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

	// Poll satellites only when GPS dropdown is open and expanded
	$effect(() => {
		if (openDropdown === 'gps' && satellitesExpanded) {
			// Initial fetch
			void fetchSatelliteData();

			// Poll every 5 seconds while panel is open (reduced from 10s for fresher data)
			const interval = setInterval(() => void fetchSatelliteData(), 5000);

			// Cleanup when panel closes
			return () => clearInterval(interval);
		}
	});

	async function fetchHardwareStatus() {
		// Primary source: resource manager tracks detected + owner
		try {
			const res = await fetch('/api/hardware/status');
			if (!res.ok) return;
			const status = await res.json();

			const alfa = status.alfa;
			if (alfa?.detected) {
				wifiState = alfa.owner ? 'active' : 'standby';
				wifiInfo = { ...wifiInfo, owner: alfa.owner || undefined };
			} else {
				wifiState = 'offline';
				wifiInfo = {};
			}

			const hackrf = status.hackrf;
			if (hackrf?.detected) {
				sdrState = hackrf.owner ? 'active' : 'standby';
				sdrInfo = { ...sdrInfo, owner: hackrf.owner || undefined };
			} else {
				sdrState = 'offline';
				sdrInfo = {};
			}
		} catch (_error: unknown) {
			// Silently fail
		}
	}

	async function fetchHardwareDetails() {
		// Detailed hardware info from sysfs (called once, not polled)
		try {
			const res = await fetch('/api/hardware/details');
			if (!res.ok) return;
			const details = await res.json();

			if (details.wifi) {
				wifiInfo = {
					...wifiInfo,
					interface: details.wifi.interface || undefined,
					monitorInterface: details.wifi.monitorInterface || undefined,
					mac: details.wifi.mac || undefined,
					driver: details.wifi.driver || undefined,
					chipset: details.wifi.chipset || undefined,
					mode: details.wifi.mode || undefined,
					channel: details.wifi.channel || undefined,
					bands: details.wifi.bands || undefined
				};
			}

			if (details.sdr) {
				sdrInfo = {
					...sdrInfo,
					serial: details.sdr.serial || undefined,
					product: details.sdr.product || undefined,
					manufacturer: details.sdr.manufacturer || undefined,
					firmwareApi: details.sdr.firmwareApi || undefined,
					usbSpeed: details.sdr.usbSpeed || undefined,
					maxPower: details.sdr.maxPower || undefined,
					configuration: details.sdr.configuration || undefined
				};
			}

			if (details.gps) {
				gpsInfo = {
					device: details.gps.device || undefined,
					protocol: details.gps.protocol || undefined,
					baudRate: details.gps.baudRate || undefined,
					usbAdapter: details.gps.usbAdapter || undefined,
					gpsdVersion: details.gps.gpsdVersion || undefined
				};
			}
		} catch (_error: unknown) {
			// Silently fail
		}
	}

	async function fetchWeather(lat: number, lon: number) {
		// Only refetch if moved >1km or no data yet
		if (weather) {
			const R = 6371000;
			const dLat = ((lat - lastWeatherLat) * Math.PI) / 180;
			const dLon = ((lon - lastWeatherLon) * Math.PI) / 180;
			const a =
				Math.sin(dLat / 2) ** 2 +
				Math.cos((lastWeatherLat * Math.PI) / 180) *
					Math.cos((lat * Math.PI) / 180) *
					Math.sin(dLon / 2) ** 2;
			const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			if (dist < 1000) return;
		}

		try {
			const res = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
			if (!res.ok) return;
			const data = await res.json();
			if (data.error) return;

			weather = {
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
			lastWeatherLat = lat;
			lastWeatherLon = lon;
		} catch (_error: unknown) {
			// Silently fail
		}
	}

	async function fetchSatelliteData() {
		try {
			const res = await fetch('/api/gps/satellites');
			if (!res.ok) return;
			const data = await res.json();

			if (data.success && data.satellites) {
				satelliteData = data.satellites;
				satelliteUsedCount = data.satellites.filter((s: Satellite) => s.used).length;
			}
		} catch (_error: unknown) {
			// Silently fail like other status fetches
		}
	}

	function getWeatherIcon(code: number, isDay: boolean): string {
		// Sun/moon for clear
		if (code <= 1) {
			if (isDay)
				return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
		}
		// Cloud
		if (code <= 3)
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
		// Fog
		if (code >= 45 && code <= 48)
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="8" x2="21" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/></svg>`;
		// Rain/drizzle
		if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`;
		// Snow
		if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>`;
		// Thunderstorm
		if (code >= 95)
			return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>`;
		// Default cloud
		return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;
	}

	function getWeatherCondition(code: number): string {
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

	function getRfConditions(w: WeatherData): { label: string; cls: string } {
		if (w.precipitation > 5 || w.humidity > 95) return { label: 'Degraded', cls: 'warn' };
		if (w.precipitation > 0 || w.humidity > 80) return { label: 'Fair', cls: '' };
		return { label: 'Good', cls: 'accent' };
	}

	function getFlightConditions(w: WeatherData): { label: string; cls: string } {
		if (w.windGusts > 40 || w.precipitation > 2) return { label: 'No-Go', cls: 'warn' };
		if (w.windGusts > 25 || w.windSpeed > 20 || w.precipitation > 0)
			return { label: 'Caution', cls: '' };
		return { label: 'Good', cls: 'accent' };
	}

	onMount(() => {
		void fetchHardwareStatus();
		void fetchHardwareDetails();
		const statusInterval = setInterval(() => void fetchHardwareStatus(), 5000);
		const clockInterval = setInterval(updateClock, 1000);
		// Poll weather every 10 minutes using current GPS position
		const weatherInterval = setInterval(() => {
			if (currentGpsLat && currentGpsLon) {
				lastWeatherLat = 0; // Reset to force refetch
				lastWeatherLon = 0;
				void fetchWeather(currentGpsLat, currentGpsLon);
			}
		}, 600000);

		return () => {
			clearInterval(statusInterval);
			clearInterval(clockInterval);
			clearInterval(weatherInterval);
		};
	});

	function formatSerial(s: string): string {
		// Trim leading zeros, show last 8 chars
		const trimmed = s.replace(/^0+/, '');
		return trimmed.length > 12 ? '...' + trimmed.slice(-12) : trimmed;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="top-status-bar"
	onclick={(e) => {
		if (e.target === e.currentTarget) closeDropdown();
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
						{#if wifiInfo.chipset}
							<div class="dropdown-row">
								<span class="dropdown-key">Chipset</span><span class="dropdown-val"
									>{wifiInfo.chipset}</span
								>
							</div>
						{/if}
						{#if wifiInfo.mac}
							<div class="dropdown-row">
								<span class="dropdown-key">MAC</span><span class="dropdown-val"
									>{wifiInfo.mac}</span
								>
							</div>
						{/if}
						{#if wifiInfo.driver}
							<div class="dropdown-row">
								<span class="dropdown-key">Driver</span><span class="dropdown-val"
									>{wifiInfo.driver}</span
								>
							</div>
						{/if}
						<div class="dropdown-row">
							<span class="dropdown-key">Interface</span><span class="dropdown-val"
								>{wifiInfo.monitorInterface || wifiInfo.interface || '—'}</span
							>
						</div>
						{#if wifiInfo.mode}
							<div class="dropdown-row">
								<span class="dropdown-key">Mode</span><span class="dropdown-val"
									>{wifiInfo.mode}</span
								>
							</div>
						{/if}
						{#if wifiInfo.channel}
							<div class="dropdown-row">
								<span class="dropdown-key">Channel</span><span class="dropdown-val"
									>{wifiInfo.channel}</span
								>
							</div>
						{/if}
						{#if wifiInfo.bands && wifiInfo.bands.length > 0}
							<div class="dropdown-row">
								<span class="dropdown-key">Bands</span><span class="dropdown-val"
									>{wifiInfo.bands.join(', ')}</span
								>
							</div>
						{/if}
						{#if wifiInfo.owner}
							<div class="dropdown-row">
								<span class="dropdown-key">Used by</span><span
									class="dropdown-val accent">{wifiInfo.owner}</span
								>
							</div>
						{/if}
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
						{#if sdrInfo.manufacturer}
							<div class="dropdown-row">
								<span class="dropdown-key">Make</span><span class="dropdown-val"
									>{sdrInfo.manufacturer}</span
								>
							</div>
						{/if}
						{#if sdrInfo.product}
							<div class="dropdown-row">
								<span class="dropdown-key">Model</span><span class="dropdown-val"
									>{sdrInfo.product}</span
								>
							</div>
						{/if}
						{#if sdrInfo.serial}
							<div class="dropdown-row">
								<span class="dropdown-key">Serial</span><span class="dropdown-val"
									>{formatSerial(sdrInfo.serial)}</span
								>
							</div>
						{/if}
						{#if sdrInfo.firmwareApi}
							<div class="dropdown-row">
								<span class="dropdown-key">FW API</span><span class="dropdown-val"
									>{sdrInfo.firmwareApi}</span
								>
							</div>
						{/if}
						{#if sdrInfo.usbSpeed}
							<div class="dropdown-row">
								<span class="dropdown-key">USB</span><span class="dropdown-val"
									>{sdrInfo.usbSpeed}</span
								>
							</div>
						{/if}
						{#if sdrInfo.maxPower}
							<div class="dropdown-row">
								<span class="dropdown-key">Power</span><span class="dropdown-val"
									>{sdrInfo.maxPower}</span
								>
							</div>
						{/if}
						{#if sdrInfo.configuration}
							<div class="dropdown-row">
								<span class="dropdown-key">Mode</span><span class="dropdown-val"
									>{sdrInfo.configuration}</span
								>
							</div>
						{/if}
						{#if sdrInfo.owner}
							<div class="dropdown-row">
								<span class="dropdown-key">Used by</span><span
									class="dropdown-val accent">{sdrInfo.owner}</span
								>
							</div>
						{:else}
							<div class="dropdown-row">
								<span class="dropdown-key">Status</span><span
									class="dropdown-val dim">Idle</span
								>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>

		<!-- GPS + SAT count -->
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
							<span class="dropdown-key">Satellites</span><span class="dropdown-val">
								{gpsSats}
								<span class="expand-icon" class:expanded={satellitesExpanded}
									>▼</span
								>
							</span>
						</div>

						{#if satellitesExpanded && satelliteData.length > 0}
							<div class="satellites-list">
								{#each satelliteData as sat}
									<div class="dropdown-row satellite-item">
										<span class="dropdown-key"
											>PRN {sat.prn} ({sat.constellation})</span
										>
										<span class="dropdown-val">{sat.snr} dB</span>
									</div>
								{/each}

								<div class="dropdown-divider"></div>
								<div class="dropdown-row">
									<span class="dropdown-key">Used for Fix</span>
									<span class="dropdown-val accent">{satelliteUsedCount}</span>
								</div>
							</div>
						{/if}

						{#if gpsSpeed !== null}
							<div class="dropdown-row">
								<span class="dropdown-key">Speed</span><span class="dropdown-val"
									>{gpsSpeed.toFixed(1)} m/s</span
								>
							</div>
						{/if}
						{#if gpsAccuracy !== null}
							<div class="dropdown-row">
								<span class="dropdown-key">Accuracy</span><span class="dropdown-val"
									>{gpsAccuracy.toFixed(1)} m</span
								>
							</div>
						{/if}
						{#if gpsInfo.device}
							<div class="dropdown-divider"></div>
							<div class="dropdown-row">
								<span class="dropdown-key">Device</span><span class="dropdown-val"
									>{gpsInfo.device}</span
								>
							</div>
						{/if}
						{#if gpsInfo.protocol}
							<div class="dropdown-row">
								<span class="dropdown-key">Protocol</span><span class="dropdown-val"
									>{gpsInfo.protocol}</span
								>
							</div>
						{/if}
						{#if gpsInfo.baudRate}
							<div class="dropdown-row">
								<span class="dropdown-key">Baud</span><span class="dropdown-val"
									>{gpsInfo.baudRate}</span
								>
							</div>
						{/if}
						{#if gpsInfo.usbAdapter}
							<div class="dropdown-row">
								<span class="dropdown-key">Adapter</span><span class="dropdown-val"
									>{gpsInfo.usbAdapter}</span
								>
							</div>
						{/if}
						{#if gpsInfo.gpsdVersion}
							<div class="dropdown-row">
								<span class="dropdown-key">GPSD</span><span class="dropdown-val"
									>v{gpsInfo.gpsdVersion}</span
								>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right side: location, coords, time -->
	<div class="coords-group">
		{#if locationName}
			<span class="coord-value location-name">{locationName}</span>
			<span class="coord-sep">|</span>
		{/if}
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

				{#if openDropdown === 'weather'}
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
							<span class="dropdown-key">Precipitation</span><span
								class="dropdown-val">{weather.precipitation.toFixed(1)} mm</span
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
				{/if}
			</div>
			<span class="coord-sep">|</span>
		{/if}
		{#if gpsCoords.lat}
			<span class="coord-value">{gpsCoords.lat}</span>
			<span class="coord-sep">/</span>
			<span class="coord-value">{gpsCoords.lon}</span>
			<span class="coord-sep">|</span>
			<span class="coord-value">{gpsCoords.mgrs}</span>
			<span class="coord-sep">|</span>
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

	/* Each device button + dropdown wrapped in a relative container */
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

	/* Three-state dots */
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

	/* Device info dropdown — positioned below its parent wrapper */
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

	/* Right side coords */
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

	.weather-dropdown {
		right: 0;
		left: auto;
	}

	.time-value {
		letter-spacing: 0.08em;
	}

	/* ============================================
	   RESPONSIVE DESIGN - Mobile-First Progressive Enhancement
	   ============================================ */

	/* Large tablets and desktop (1024px+): Show everything */
	@media (max-width: 1023px) {
		.weather-wrapper,
		.weather-wrapper + .coord-sep {
			display: none;
		}
	}

	/* Tablets (768px - 1023px): Hide weather, show core info */
	@media (max-width: 900px) {
		.status-label {
			font-size: 11px;
		}
	}

	/* Small tablets and large phones (600px - 767px): Compact mode */
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

		/* Hide MGRS on smaller screens */
		.coords-group span:nth-child(7),
		.coords-group span:nth-child(8) {
			display: none;
		}

		.coord-value {
			font-size: 11px;
		}
	}

	/* Phones landscape (480px - 599px): Icon-only mode */
	@media (max-width: 599px) {
		.status-divider {
			display: none;
		}

		.status-label {
			display: none;
		}

		/* Show only dots and essential coords */
		.coords-group {
			font-size: 10px;
			gap: var(--space-1);
		}

		/* Show only lat/lon, hide time */
		.time-value {
			display: none;
		}
	}

	/* Phones portrait (320px - 479px): Minimal mode */
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

		/* Make status dots larger for touch */
		.status-dot {
			width: 10px;
			height: 10px;
		}

		/* Ensure touch targets are at least 44px */
		.device-btn {
			padding: 8px;
			min-width: 44px;
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}

	/* ============================================
	   SATELLITES EXPANDABLE PANEL
	   ============================================ */

	/* Satellites expandable row */
	.satellites-toggle {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.satellites-toggle:hover {
		background: var(--palantir-bg-hover);
	}

	/* Expand icon */
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

	/* Nested satellite list */
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

	/* Individual satellite rows */
	.satellite-item .dropdown-key,
	.satellite-item .dropdown-val {
		font-size: 10px;
	}
</style>
