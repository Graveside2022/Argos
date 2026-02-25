<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';

	import NetworkLatencyWidget from '$lib/components/dashboard/widgets/NetworkLatencyWidget.svelte';
	import NodeMeshWidget from '$lib/components/dashboard/widgets/NodeMeshWidget.svelte';
	import SpeedTestWidget from '$lib/components/dashboard/widgets/SpeedTestWidget.svelte';
	import WeatherWidget from '$lib/components/dashboard/widgets/WeatherWidget.svelte';
	import {
		activePanel,
		type ActiveView,
		activeView
	} from '$lib/stores/dashboard/dashboard-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import { takStatus } from '$lib/stores/tak-store';
	import type { SystemInfo } from '$lib/types/system';
	import { fetchJSON } from '$lib/utils/fetch-json';

	import GpsCard from './overview/GpsCard.svelte';
	import HardwareCard from './overview/HardwareCard.svelte';
	import ServicesCard from './overview/ServicesCard.svelte';
	import SystemInfoCard from './overview/SystemInfoCard.svelte';
	import type { HardwareDetails, HardwareStatus } from './overview/types';
	import WifiInterfacesCard from './overview/WifiInterfacesCard.svelte';

	let systemInfo: SystemInfo | null = $state(null);
	let hardwareStatus: HardwareStatus | null = $state(null);
	let hardwareDetails: HardwareDetails | null = $state(null);
	let expandedRow: string | null = $state(null);

	function toggleExpand(id: string) {
		expandedRow = expandedRow === id ? null : id;
	}

	function openTool(view: ActiveView) {
		activeView.set(view);
		activePanel.set(null);
	}

	async function fetchSystem() {
		systemInfo = await fetchJSON<SystemInfo>('/api/system/info');
	}

	async function fetchHardware() {
		hardwareStatus = await fetchJSON<HardwareStatus>('/api/hardware/status');
	}

	async function fetchHardwareDetails() {
		hardwareDetails = await fetchJSON<HardwareDetails>('/api/hardware/details');
	}

	onMount(() => {
		void fetchSystem();
		void fetchHardware();
		void fetchHardwareDetails();
		// Refresh system info every 5 seconds for responsive updates
		const refreshInterval = setInterval(() => {
			void fetchSystem();
			void fetchHardware();
		}, 5000);
		return () => {
			clearInterval(refreshInterval);
		};
	});
</script>

<div class="overview-panel">
	<header class="panel-header">
		<span class="panel-title">SYSTEM OVERVIEW</span>
	</header>

	<!-- Sections 1-5: CPU, Disk, Memory, Power, Network Status -->
	<SystemInfoCard {systemInfo} />

	<!-- Section 6: Hardware -->
	<HardwareCard {hardwareStatus} {hardwareDetails} {expandedRow} onToggleExpand={toggleExpand} />

	<!-- Section 7: GPS Position -->
	<GpsCard status={$gpsStore.status} />

	<!-- Section 8: Services -->
	<ServicesCard
		kismetStatus={$kismetStore.status}
		kismetDeviceCount={$kismetStore.deviceCount}
		gpsHasFix={$gpsStore.status.hasGPSFix}
		gpsSatellites={$gpsStore.status.satellites}
		takStatus={$takStatus.status}
		takMessageCount={$takStatus.messageCount ?? 0}
		gpsDetails={hardwareDetails?.gps}
		{expandedRow}
		onToggleExpand={toggleExpand}
		onOpenKismet={() => openTool('kismet')}
		onOpenTakConfig={() => activeView.set('tak-config')}
	/>

	<!-- Section 9: WiFi Interfaces -->
	{#if systemInfo}
		<WifiInterfacesCard interfaces={systemInfo.wifiInterfaces} />
	{/if}

	<!-- Section 10: Sidebar Widgets -->
	<div class="widgets-container">
		<SpeedTestWidget />
		<NetworkLatencyWidget connected={$kismetStore.status === 'running'} latency={0} />
		<WeatherWidget />
		<NodeMeshWidget connectedNodes={$takStatus.status === 'connected' ? 1 : 0} totalNodes={1} />
	</div>
</div>

<style>
	.overview-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--border);
	}

	.panel-title {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--foreground-secondary, #888888);
	}

	.widgets-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 12px;
	}
</style>
