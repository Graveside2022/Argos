<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Button pattern extraction deferred to component library refactor -->
<script lang="ts">
	import { Network, Signal } from '@lucide/svelte';
	import { onMount } from 'svelte';

	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import type { PingResult, TailscalePeer, TakServer } from '$lib/types/network';
	import { fetchJSON } from '$lib/utils/fetch-json';

	interface MeshStatusResponse {
		takServers: TakServer[];
		peers: TailscalePeer[];
		selfHostname: string;
	}

	import LatencyDropdown from './status/LatencyDropdown.svelte';
	import MeshDropdown from './status/MeshDropdown.svelte';
	import {
		type DeviceState,
		fetchHardwareDetails,
		fetchHardwareStatus,
		fetchWeather,
		type GpsInfo,
		type SdrInfo,
		type WifiInfo
	} from './status/status-bar-data';
	import {
		getWeatherCondition,
		getWeatherIcon,
		type WeatherData
	} from './status/weather-helpers';
	import WeatherDropdown from './status/WeatherDropdown.svelte';

	let wifiState = $state<DeviceState>('offline');
	let sdrState = $state<DeviceState>('offline');
	let gpsState = $state<DeviceState>('offline');

	// REC badge — shown when any hardware is actively collecting
	let isCollecting = $derived(
		wifiState === 'active' || sdrState === 'active' || gpsState === 'active'
	);

	// Network latency — real Pi-to-target ping measurements
	let pingResults: PingResult[] = $state([]);
	let pingLoading = $state(false);
	let latencyMs = $derived(
		pingResults.reduce<number | null>((best, r) => {
			if (r.latencyMs === null) return best;
			return best === null ? r.latencyMs : Math.min(best, r.latencyMs);
		}, null)
	);

	let wifiInfo: WifiInfo = $state({});
	let sdrInfo: SdrInfo = $state({});
	let _gpsInfo: GpsInfo = $state({});

	let _gpsSats = $state(0);
	let _gpsSpeed: number | null = $state(null);
	let _gpsAccuracy: number | null = $state(null);
	let _gpsFix = $state(0);
	let zuluTime = $state('');
	let dateStr = $state('');
	let openDropdown: 'wifi' | 'sdr' | 'gps' | 'weather' | 'latency' | 'mesh' | null = $state(null);

	let weather: WeatherData | null = $state(null);
	let lastWeatherLat = 0;
	let lastWeatherLon = 0;
	let currentGpsLat = 0;
	let currentGpsLon = 0;

	// Mesh data from Tailscale + TAK
	let meshData: MeshStatusResponse = $state({ takServers: [], peers: [], selfHostname: '' });
	let meshLoading = $state(false);
	let takConnected = $derived(meshData.takServers.some((s) => s.connected));
	let meshDisplay = $derived(takConnected ? 'TAK' : '\u2014');

	const MONTHS = [
		'JAN',
		'FEB',
		'MAR',
		'APR',
		'MAY',
		'JUN',
		'JUL',
		'AUG',
		'SEP',
		'OCT',
		'NOV',
		'DEC'
	];

	function updateClock() {
		const now = new Date();
		zuluTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
		dateStr = `${String(now.getUTCDate()).padStart(2, '0')} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
	}
	updateClock();

	function toggleDropdown(which: 'wifi' | 'sdr' | 'gps' | 'weather' | 'latency' | 'mesh') {
		openDropdown = openDropdown === which ? null : which;
	}

	const FIX_TYPE_MAP: Record<string, number> = { '3D': 3, '2D': 2 };

	function resetGpsState(state: 'offline' | 'standby') {
		gpsState = state;
		_gpsSats = 0;
		_gpsSpeed = null;
		_gpsAccuracy = null;
		_gpsFix = 0;
	}

	function applyGpsFix(gps: typeof $gpsStore) {
		const s = gps.status;
		gpsState = 'active';
		_gpsSats = s.satellites;
		_gpsSpeed = s.speed;
		_gpsAccuracy = s.accuracy || null;
		_gpsFix = FIX_TYPE_MAP[s.fixType] ?? 0;
		currentGpsLat = gps.position.lat;
		currentGpsLon = gps.position.lon;
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
	}

	function applyHardwareDetails(
		d: import('./status/status-bar-data').HardwareDetailsResult | null
	) {
		if (!d) return;
		if (d.wifi) wifiInfo = { ...wifiInfo, ...d.wifi };
		if (d.sdr) sdrInfo = { ...sdrInfo, ...d.sdr };
		if (d.gps) _gpsInfo = { ...d.gps };
	}

	$effect(() => {
		const gps = $gpsStore;
		if (gps.status.hasGPSFix) return applyGpsFix(gps);
		resetGpsState(gps.status.gpsStatus.includes('Error') ? 'offline' : 'standby');
	});

	async function fetchHardwareState() {
		const r = await fetchHardwareStatus();
		if (r) {
			wifiState = r.wifiState;
			sdrState = r.sdrState;
			wifiInfo = { ...wifiInfo, owner: r.wifiOwner };
			sdrInfo = { ...sdrInfo, owner: r.sdrOwner };
		}
	}

	async function fetchNetworkLatency() {
		pingLoading = true;
		try {
			const data = await fetchJSON<{ results: PingResult[] }>('/api/system/network-latency');
			if (data?.results) pingResults = data.results;
		} finally {
			pingLoading = false;
		}
	}

	async function fetchMeshStatus() {
		meshLoading = true;
		try {
			const data = await fetchJSON<MeshStatusResponse>('/api/system/mesh-status');
			if (data) meshData = data;
		} finally {
			meshLoading = false;
		}
	}

	onMount(() => {
		void fetchHardwareState();
		void fetchNetworkLatency();
		void fetchMeshStatus();
		void fetchHardwareDetails().then((d) => applyHardwareDetails(d));
		const statusInterval = setInterval(() => void fetchHardwareState(), 5000);
		const latencyInterval = setInterval(() => void fetchNetworkLatency(), 30000);
		const meshInterval = setInterval(() => void fetchMeshStatus(), 30000);
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
			clearInterval(latencyInterval);
			clearInterval(meshInterval);
			clearInterval(clockInterval);
			clearInterval(weatherInterval);
		};
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="command-bar"
	onclick={(e) => {
		if (e.target === e.currentTarget) openDropdown = null;
	}}
>
	<!-- Left group: Brand + Collection + Callsign + Hardware -->
	<div class="left-group">
		<span class="brand-mark">ARGOS</span>
		<span class="rec-indicator">
			<span class="collection-dot"></span>
			{#if isCollecting}<span class="rec-badge">REC</span>{/if}
		</span>
		<span class="callsign">ARGOS-1</span>
	</div>

	<!-- Spacer -->
	<div class="bar-spacer"></div>

	<!-- Right group: Latency + Mesh + Weather + Date + Zulu -->
	<div class="right-group">
		<div class="device-wrapper">
			<button
				class="segment segment-latency segment-btn"
				onclick={() => toggleDropdown('latency')}
			>
				<Signal size={12} class="segment-icon" />
				{latencyMs ?? '--'}ms
			</button>
			{#if openDropdown === 'latency'}
				<LatencyDropdown
					results={pingResults}
					loading={pingLoading}
					onping={fetchNetworkLatency}
				/>
			{/if}
		</div>
		<div class="device-wrapper">
			<button class="segment segment-mesh segment-btn" onclick={() => toggleDropdown('mesh')}>
				<Network size={12} class="segment-icon" />
				{meshDisplay}
			</button>
			{#if openDropdown === 'mesh'}
				<MeshDropdown
					takServers={meshData.takServers}
					peers={meshData.peers}
					selfHostname={meshData.selfHostname}
					loading={meshLoading}
					onrefresh={fetchMeshStatus}
				/>
			{/if}
		</div>
		{#if weather}
			<div class="device-wrapper">
				<button class="segment segment-weather" onclick={() => toggleDropdown('weather')}>
					<!-- @constitutional-exemption Article-IX-9.4 issue:#13 — getWeatherIcon() returns hardcoded SVG strings, no user input -->
					<span class="weather-icon"
						>{@html getWeatherIcon(weather.weatherCode, weather.isDay)}</span
					>
					<span>{Math.round(weather.temperature)}°F</span>
					<span class="weather-desc">{getWeatherCondition(weather.weatherCode)}</span>
				</button>
				{#if openDropdown === 'weather'}<WeatherDropdown {weather} />{/if}
			</div>
		{:else}
			<span class="segment segment-muted">--°F</span>
		{/if}
		<span class="segment segment-date">{dateStr}</span>
		<span class="segment segment-zulu">{zuluTime}</span>
	</div>
</div>

<style>
	@import './command-bar.css';
</style>
