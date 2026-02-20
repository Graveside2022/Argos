<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { onMount } from 'svelte';

	import TAKIndicator from '$lib/components/status/TAKIndicator.svelte';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';

	import CoordsDisplay from './status/CoordsDisplay.svelte';
	import GpsDropdown from './status/GpsDropdown.svelte';
	import SdrDropdown from './status/SdrDropdown.svelte';
	import {
		type DeviceState,
		fetchHardwareDetails,
		fetchHardwareStatus,
		fetchWeather,
		type GpsInfo,
		reverseGeocode,
		type SdrInfo,
		type WifiInfo
	} from './status/status-bar-data';
	import type { WeatherData } from './status/weather-helpers';
	import WifiDropdown from './status/WifiDropdown.svelte';

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

		<WifiDropdown
			deviceState={wifiState}
			info={wifiInfo}
			open={openDropdown === 'wifi'}
			onToggle={() => toggleDropdown('wifi')}
		/>

		<SdrDropdown
			deviceState={sdrState}
			info={sdrInfo}
			open={openDropdown === 'sdr'}
			onToggle={() => toggleDropdown('sdr')}
		/>

		<GpsDropdown
			deviceState={gpsState}
			info={gpsInfo}
			sats={gpsSats}
			fix={gpsFix}
			speed={gpsSpeed}
			accuracy={gpsAccuracy}
			open={openDropdown === 'gps'}
			onToggle={() => toggleDropdown('gps')}
		/>

		<TAKIndicator />
	</div>

	<CoordsDisplay
		{locationName}
		{weather}
		{gpsCoords}
		{zuluTime}
		weatherOpen={openDropdown === 'weather'}
		onToggleWeather={() => toggleDropdown('weather')}
	/>
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
	}
	@media (max-width: 599px) {
		.status-divider {
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
	}
</style>
