<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';

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
		<span class="panel-title">OVERVIEW</span>
	</header>

	<SystemInfoCard {systemInfo} />

	<GpsCard status={$gpsStore.status} />

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

	<HardwareCard {hardwareStatus} {hardwareDetails} {expandedRow} onToggleExpand={toggleExpand} />

	{#if systemInfo}
		<WifiInterfacesCard interfaces={systemInfo.wifiInterfaces} />
	{/if}
</div>

<style>
	.overview-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}
</style>
