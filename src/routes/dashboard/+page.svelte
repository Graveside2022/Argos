<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import '$lib/styles/dashboard.css';

	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import AgentChatPanel from '$lib/components/dashboard/AgentChatPanel.svelte';
	import DashboardMap from '$lib/components/dashboard/DashboardMap.svelte';
	import DashboardShell from '$lib/components/dashboard/DashboardShell.svelte';
	import LogsPanel from '$lib/components/dashboard/LogsPanel.svelte';
	import PanelContainer from '$lib/components/dashboard/PanelContainer.svelte';
	import CapturesPanel from '$lib/components/dashboard/panels/CapturesPanel.svelte';
	import DevicesPanel from '$lib/components/dashboard/panels/DevicesPanel.svelte';
	import ResizableBottomPanel from '$lib/components/dashboard/ResizableBottomPanel.svelte';
	import TakConfigView from '$lib/components/dashboard/tak/TakConfigView.svelte';
	import TerminalPanel from '$lib/components/dashboard/TerminalPanel.svelte';
	import KismetView from '$lib/components/dashboard/views/KismetView.svelte';
	import LogsAnalyticsView from '$lib/components/dashboard/views/LogsAnalyticsView.svelte';
	import OpenWebRXView from '$lib/components/dashboard/views/OpenWebRXView.svelte';
	import ToolUnavailableView from '$lib/components/dashboard/views/ToolUnavailableView.svelte';
	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import {
		activeBottomTab,
		activePanel,
		activeView,
		bottomPanelHeight,
		closeBottomPanel,
		isBottomPanelOpen,
		openBottomPanel,
		setBottomPanelHeight
	} from '$lib/stores/dashboard/dashboard-store';
	import {
		createSession,
		nextTab,
		previousTab,
		toggleTerminalPanel
	} from '$lib/stores/dashboard/terminal-store';
	import { GPSService } from '$lib/tactical-map/gps-service';
	import { KismetService } from '$lib/tactical-map/kismet-service';
	import { TakService } from '$lib/tactical-map/tak-service';

	import BottomPanelTabs from './BottomPanelTabs.svelte';

	const FULL_WIDTH_VIEWS = new Set(['tak-config', 'gsm-evil']);
	let shellMode = $derived(
		FULL_WIDTH_VIEWS.has($activeView) ? ('full-width' as const) : ('sidebar' as const)
	);

	const gpsService = new GPSService();
	const kismetService = new KismetService();
	const takService = new TakService();

	let mountedTabs = $state(new Set<string>());

	$effect(() => {
		const tab = $activeBottomTab;
		if (tab && !mountedTabs.has(tab)) {
			mountedTabs = new Set([...mountedTabs, tab]);
		}
	});

	function goBackToMap() {
		activeView.set('map');
	}

	type ShortcutEntry = { ctrl: boolean; shift: boolean; key: string; action: () => void };
	const SHORTCUTS: ShortcutEntry[] = [
		{ ctrl: true, shift: false, key: '`', action: toggleTerminalPanel },
		{ ctrl: true, shift: true, key: '`', action: createSession },
		{ ctrl: true, shift: true, key: '[', action: previousTab },
		{ ctrl: true, shift: true, key: ']', action: nextTab }
	];

	function matchShortcut(e: KeyboardEvent): ShortcutEntry | undefined {
		return SHORTCUTS.find(
			(s) => e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.key === s.key
		);
	}

	function handleEscape() {
		if ($isBottomPanelOpen) closeBottomPanel();
		else if ($activeView !== 'map') activeView.set('map');
		else if ($activePanel !== null) activePanel.set(null);
	}

	function handleKeydown(e: KeyboardEvent) {
		const shortcut = matchShortcut(e);
		if (shortcut) {
			e.preventDefault();
			shortcut.action();
			return;
		}
		if (e.key === 'Escape') handleEscape();
	}

	onMount(() => {
		if (!browser) return;
		gpsService.startPositionUpdates();
		kismetService.startPeriodicStatusCheck();
		kismetService.startPeriodicDeviceFetch();
		void kismetService.fetchKismetDevices();
		takService.startPeriodicStatusCheck();
	});

	onDestroy(() => {
		gpsService.stopPositionUpdates();
		kismetService.stopPeriodicChecks();
		takService.stopPeriodicChecks();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<DashboardShell mode={shellMode}>
	{#snippet sidebar()}
		{#if $activeView === 'map'}
			<PanelContainer />
		{/if}
	{/snippet}

	{#snippet content()}
		<div class="dashboard-content">
			{#if $activeView === 'map'}
				<DashboardMap />
			{:else if $activeView === 'kismet'}
				<KismetView />
			{:else if $activeView === 'openwebrx'}
				<OpenWebRXView />
			{:else if $activeView === 'bettercap'}
				<ToolViewWrapper title="Bettercap" onBack={goBackToMap}>
					<iframe src="http://localhost:80" title="Bettercap" class="tool-iframe"
					></iframe>
				</ToolViewWrapper>
			{:else if $activeView === 'hackrf'}
				<ToolUnavailableView title="HackRF Spectrum Analyzer" />
			{:else if $activeView === 'rtl-433'}
				<ToolUnavailableView title="RTL-433 Decoder" />
			{:else if $activeView === 'btle'}
				<ToolUnavailableView title="BTLE Scanner" />
			{:else if $activeView === 'droneid'}
				<ToolUnavailableView title="Drone ID" />
			{:else if $activeView === 'pagermon'}
				<ToolUnavailableView title="Pagermon" />
			{:else if $activeView === 'rf-emitter'}
				<ToolUnavailableView title="RF Emitter" />
			{:else if $activeView === 'wifite'}
				<ToolUnavailableView title="Wifite2" />
			{:else if $activeView === 'wigletotak'}
				<ToolUnavailableView title="WigleToTAK" />
			{:else if $activeView === 'logs-analytics'}
				<LogsAnalyticsView />
			{:else}
				<ToolUnavailableView title={$activeView} />
			{/if}
		</div>
	{/snippet}

	{#snippet fullWidth()}
		{#if $activeView === 'tak-config'}
			<TakConfigView />
		{:else if $activeView === 'gsm-evil'}
			<ToolViewWrapper title="GSM Evil" onBack={goBackToMap}>
				<iframe src="/gsm-evil" title="GSM Evil" class="tool-iframe"></iframe>
			</ToolViewWrapper>
		{/if}
	{/snippet}

	{#snippet bottomPanel()}
		<!--
			ResizableBottomPanel wraps EVERYTHING (tab bar + content).
			- Drag handle is at the very top edge — intuitive "grab top to resize"
			- When collapsed: panel height = 0, but tab bar inside still shows via min-height
			- Tab bar always visible; chevron rotates ▼/▲ to show collapse state
		-->
		<ResizableBottomPanel
			isOpen={$isBottomPanelOpen}
			height={$bottomPanelHeight}
			onHeightChange={setBottomPanelHeight}
			onOpen={openBottomPanel}
		>
			<!-- Tab bar sits inside the resizable panel, always rendered -->
			<BottomPanelTabs activeTab={$activeBottomTab} />

			<!-- Content area shown only when open -->
			<div class="bottom-panel-content">
				{#if mountedTabs.has('terminal')}
					<div class="tab-pane" class:tab-active={$activeBottomTab === 'terminal'}>
						<TerminalPanel />
					</div>
				{/if}
				{#if mountedTabs.has('chat')}
					<div class="tab-pane" class:tab-active={$activeBottomTab === 'chat'}>
						<AgentChatPanel />
					</div>
				{/if}
				{#if mountedTabs.has('logs')}
					<div class="tab-pane" class:tab-active={$activeBottomTab === 'logs'}>
						<LogsPanel />
					</div>
				{/if}
				{#if mountedTabs.has('captures')}
					<div class="tab-pane" class:tab-active={$activeBottomTab === 'captures'}>
						<CapturesPanel />
					</div>
				{/if}
				{#if mountedTabs.has('devices')}
					<div class="tab-pane" class:tab-active={$activeBottomTab === 'devices'}>
						<DevicesPanel />
					</div>
				{/if}
			</div>
		</ResizableBottomPanel>
	{/snippet}
</DashboardShell>

<style>
	@import './dashboard-page.css';
</style>
