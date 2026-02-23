<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import '$lib/styles/palantir-design-system.css';
	import '$lib/styles/dashboard.css';

	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import AgentChatPanel from '$lib/components/dashboard/AgentChatPanel.svelte';
	import DashboardMap from '$lib/components/dashboard/DashboardMap.svelte';
	import IconRail from '$lib/components/dashboard/IconRail.svelte';
	import LogsPanel from '$lib/components/dashboard/LogsPanel.svelte';
	import PanelContainer from '$lib/components/dashboard/PanelContainer.svelte';
	import DevicesPanel from '$lib/components/dashboard/panels/DevicesPanel.svelte';
	import GsmEvilPanel from '$lib/components/dashboard/panels/GsmEvilPanel.svelte';
	import ResizableBottomPanel from '$lib/components/dashboard/ResizableBottomPanel.svelte';
	import TakConfigView from '$lib/components/dashboard/tak/TakConfigView.svelte';
	import TerminalPanel from '$lib/components/dashboard/TerminalPanel.svelte';
	import TopStatusBar from '$lib/components/dashboard/TopStatusBar.svelte';
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
		setBottomPanelHeight
	} from '$lib/stores/dashboard/dashboard-store';
	import {
		createSession,
		nextTab,
		previousTab,
		terminalPanelState,
		toggleTerminalPanel
	} from '$lib/stores/dashboard/terminal-store';
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { GPSService } from '$lib/tactical-map/gps-service';
	import { KismetService } from '$lib/tactical-map/kismet-service';
	import { TakService } from '$lib/tactical-map/tak-service';

	import BottomPanelTabs from './BottomPanelTabs.svelte';

	const gpsService = new GPSService();
	const kismetService = new KismetService();
	const takService = new TakService();

	// Track which bottom-panel tabs have been visited at least once.
	// Visited tabs stay mounted (hidden via CSS) so terminals/logs keep their scrollback.
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

	/** Keyboard shortcut key → action. Checked with modifier guards. */
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
		// Do an immediate device fetch (the interval only fires after 10s)
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

<div class="dashboard-shell">
	<TopStatusBar />
	<div class="dashboard-body rail-{themeStore.railPosition}">
		<IconRail />
		<div class="dashboard-main">
			<!-- Panel at top position (above content, inside dashboard-main) -->
			{#if themeStore.railPosition === 'top' && $activeView === 'map'}
				<PanelContainer />
			{/if}

			<!-- Main content area -->
			<div class="dashboard-content content-{themeStore.railPosition}">
				{#if $activeView === 'map'}
					{#if themeStore.railPosition === 'left' || themeStore.railPosition === 'right'}
						<PanelContainer />
					{/if}
					<DashboardMap />
				{:else if $activeView === 'kismet'}
					<KismetView />
				{:else if $activeView === 'openwebrx'}
					<OpenWebRXView />
				{:else if $activeView === 'bettercap'}
					<ToolViewWrapper title="Bettercap" onBack={goBackToMap}>
						<iframe src="http://localhost:80" title="Bettercap" class="tool-iframe" />
					</ToolViewWrapper>
				{:else if $activeView === 'hackrf'}
					<ToolUnavailableView title="HackRF Spectrum Analyzer" />
				{:else if $activeView === 'gsm-evil'}
					<ToolViewWrapper title="GSM Evil" onBack={goBackToMap}>
						<iframe src="/gsm-evil" title="GSM Evil" class="tool-iframe"></iframe>
					</ToolViewWrapper>
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
				{:else if $activeView === 'tak-config'}
					<TakConfigView />
				{:else if $activeView === 'logs-analytics'}
					<LogsAnalyticsView />
				{:else}
					<ToolUnavailableView title={$activeView} />
				{/if}
			</div>

			<!-- Bottom panel — each panel shows solo (switching via icon rail) -->
			<ResizableBottomPanel
				isOpen={$isBottomPanelOpen}
				height={$terminalPanelState.isMaximized
					? window.innerHeight * 0.8
					: $bottomPanelHeight}
				onHeightChange={setBottomPanelHeight}
				onClose={closeBottomPanel}
			>
				<BottomPanelTabs activeTab={$activeBottomTab} />

				<!-- Panel content — tabs stay mounted after first visit so terminals/logs keep scrollback -->
				<div class="bottom-panel-content">
					{#if mountedTabs.has('devices')}
						<div class="tab-pane" class:tab-active={$activeBottomTab === 'devices'}>
							<DevicesPanel />
						</div>
					{/if}
					{#if mountedTabs.has('terminal')}
						<div class="tab-pane" class:tab-active={$activeBottomTab === 'terminal'}>
							<TerminalPanel />
						</div>
					{/if}
					{#if mountedTabs.has('gsm-evil')}
						<div class="tab-pane" class:tab-active={$activeBottomTab === 'gsm-evil'}>
							<GsmEvilPanel />
						</div>
					{/if}
					{#if mountedTabs.has('logs')}
						<div class="tab-pane" class:tab-active={$activeBottomTab === 'logs'}>
							<LogsPanel />
						</div>
					{/if}
					{#if mountedTabs.has('chat')}
						<div class="tab-pane" class:tab-active={$activeBottomTab === 'chat'}>
							<AgentChatPanel />
						</div>
					{/if}
				</div>
			</ResizableBottomPanel>

			<!-- Panel at bottom position (below terminal, above bottom rail) -->
			{#if themeStore.railPosition === 'bottom' && $activeView === 'map'}
				<PanelContainer />
			{/if}
		</div>
	</div>
</div>

<style>
	@import './dashboard-page.css';
</style>
