<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { activeView, activePanel } from '$lib/stores/dashboard/dashboardStore';
	import { GPSService } from '$lib/services/tactical-map/gpsService';
	import { KismetService } from '$lib/services/tactical-map/kismetService';
	import '$lib/styles/palantir-design-system.css';
	import '$lib/styles/dashboard.css';

	import TopStatusBar from '$lib/components/dashboard/TopStatusBar.svelte';
	import IconRail from '$lib/components/dashboard/IconRail.svelte';
	import PanelContainer from '$lib/components/dashboard/PanelContainer.svelte';
	import DashboardMap from '$lib/components/dashboard/DashboardMap.svelte';
	import KismetView from '$lib/components/dashboard/views/KismetView.svelte';
	import OpenWebRXView from '$lib/components/dashboard/views/OpenWebRXView.svelte';
	import TerminalView from '$lib/components/dashboard/views/TerminalView.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';

	const gpsService = new GPSService();
	const kismetService = new KismetService();

	function goBackToMap() {
		activeView.set('map');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if ($activeView !== 'map') {
				activeView.set('map');
			} else if ($activePanel !== null) {
				activePanel.set(null);
			}
		}
	}

	onMount(() => {
		if (!browser) return;
		gpsService.startPositionUpdates();
		kismetService.startPeriodicStatusCheck();
		kismetService.startPeriodicDeviceFetch();
		// Do an immediate device fetch (the interval only fires after 10s)
		void kismetService.fetchKismetDevices();
	});

	onDestroy(() => {
		gpsService.stopPositionUpdates();
		kismetService.stopPeriodicChecks();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dashboard-shell">
	<TopStatusBar />
	<div class="dashboard-body">
		<IconRail />
		{#if $activeView === 'map'}
			<PanelContainer />
			<DashboardMap />
		{:else if $activeView === 'terminal'}
			<TerminalView />
		{:else if $activeView === 'kismet'}
			<KismetView />
		{:else if $activeView === 'openwebrx'}
			<OpenWebRXView />
		{:else if $activeView === 'hackrf'}
			<ToolViewWrapper title="HackRF Spectrum Analyzer" onBack={goBackToMap}>
				<iframe src="/hackrfsweep" title="HackRF Sweep" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'gsm-evil'}
			<ToolViewWrapper title="GSM Evil" onBack={goBackToMap}>
				<iframe src="/gsm-evil" title="GSM Evil" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'rtl-433'}
			<ToolViewWrapper title="RTL-433 Decoder" onBack={goBackToMap}>
				<iframe src="/rtl-433" title="RTL-433" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'bettercap'}
			<ToolViewWrapper title="Bettercap" onBack={goBackToMap}>
				<iframe src="http://localhost:80" title="Bettercap" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'btle'}
			<ToolViewWrapper title="BTLE Scanner" onBack={goBackToMap}>
				<iframe src="/btle" title="BTLE" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'droneid'}
			<ToolViewWrapper title="Drone ID" onBack={goBackToMap}>
				<iframe src="/droneid" title="Drone ID" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'pagermon'}
			<ToolViewWrapper title="Pagermon" onBack={goBackToMap}>
				<iframe src="/pagermon" title="Pagermon" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'rf-emitter'}
			<ToolViewWrapper title="RF Emitter" onBack={goBackToMap}>
				<iframe src="/hackrf" title="RF Emitter" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'usrpsweep'}
			<ToolViewWrapper title="USRP Sweep" onBack={goBackToMap}>
				<iframe src="/usrpsweep" title="USRP Sweep" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'wifite'}
			<ToolViewWrapper title="Wifite2" onBack={goBackToMap}>
				<iframe src="/wifite" title="Wifite2" class="tool-iframe" />
			</ToolViewWrapper>
		{:else if $activeView === 'wigletotak'}
			<ToolViewWrapper title="WigleToTAK" onBack={goBackToMap}>
				<iframe src="/wigletotak" title="WigleToTAK" class="tool-iframe" />
			</ToolViewWrapper>
		{:else}
			<ToolViewWrapper title={$activeView} onBack={goBackToMap}>
				<div class="unknown-view">
					<span>Unknown tool: {$activeView}</span>
				</div>
			</ToolViewWrapper>
		{/if}
	</div>
</div>

<style>
	.tool-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--palantir-bg-app);
	}

	.unknown-view {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--palantir-text-tertiary);
		font-size: var(--text-base);
	}
</style>
