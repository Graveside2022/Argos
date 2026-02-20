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

	function handleKeydown(e: KeyboardEvent) {
		// Terminal keyboard shortcuts
		if (e.ctrlKey && e.key === '`') {
			e.preventDefault();
			toggleTerminalPanel();
			return;
		}
		if (e.ctrlKey && e.shiftKey && e.key === '`') {
			e.preventDefault();
			createSession();
			return;
		}
		if (e.ctrlKey && e.shiftKey && e.key === '[') {
			e.preventDefault();
			previousTab();
			return;
		}
		if (e.ctrlKey && e.shiftKey && e.key === ']') {
			e.preventDefault();
			nextTab();
			return;
		}

		// Escape key handling
		if (e.key === 'Escape') {
			if ($isBottomPanelOpen) {
				closeBottomPanel();
			} else if ($activeView !== 'map') {
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
				<!-- Tab bar — shows only the active tab -->
				<!-- Tab bar — shows all tabs -->
				<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Tab buttons use custom styling tightly coupled to panel layout; shadcn Tabs component incompatible with split tab-bar/panel-content architecture -->
				<div class="bottom-panel-tabs">
					<div class="tab-list">
						<!-- Terminal Tab -->
						<button
							class="panel-tab"
							class:active={$activeBottomTab === 'terminal'}
							onclick={() => activeBottomTab.set('terminal')}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="4 17 10 11 4 5" /><line
									x1="12"
									y1="19"
									x2="20"
									y2="19"
								/>
							</svg>
							Terminal
						</button>

						<!-- Logs Tab -->
						<button
							class="panel-tab"
							class:active={$activeBottomTab === 'logs'}
							onclick={() => activeBottomTab.set('logs')}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
								/>
								<line x1="12" y1="8" x2="20" y2="8" />
								<line x1="8" y1="12" x2="20" y2="12" />
								<line x1="16" y1="16" x2="20" y2="16" />
							</svg>
							Logs
						</button>

						<!-- GSM Evil Tab -->
						<button
							class="panel-tab"
							class:active={$activeBottomTab === 'gsm-evil'}
							onclick={() => activeBottomTab.set('gsm-evil')}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="2" y="7" width="20" height="15" rx="2" ry="2"
								></rect><polyline points="17 2 12 7 7 2"></polyline>
							</svg>
							GSM Evil
						</button>

						<!-- Kismet Tab (Internal: devices) -->
						<button
							class="panel-tab"
							class:active={$activeBottomTab === 'devices'}
							onclick={() => activeBottomTab.set('devices')}
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="8" y1="6" x2="21" y2="6" /><line
									x1="8"
									y1="12"
									x2="21"
									y2="12"
								/><line x1="8" y1="18" x2="21" y2="18" />
								<circle cx="4" cy="6" r="1" fill="currentColor" /><circle
									cx="4"
									cy="12"
									r="1"
									fill="currentColor"
								/><circle cx="4" cy="18" r="1" fill="currentColor" />
							</svg>
							Kismet
						</button>

						<!-- Chat Tab (Hidden unless active, or kept for continuity) -->
						{#if $activeBottomTab === 'chat'}
							<button
								class="panel-tab active"
								onclick={() => activeBottomTab.set('chat')}
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path
										d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
									/>
								</svg>
								Agent Chat
							</button>
						{/if}
					</div>
					<button class="tab-close-btn" title="Close panel" onclick={closeBottomPanel}>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							><line x1="18" y1="6" x2="6" y2="18" /><line
								x1="6"
								y1="6"
								x2="18"
								y2="18"
							/></svg
						>
					</button>
				</div>

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
	/* Main content wrapper - flex column to stack content + terminal panel */
	.dashboard-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	/* Content area - takes remaining space above terminal panel */
	.dashboard-content {
		flex: 1;
		display: flex;
		overflow: hidden;
		min-height: 0;
	}

	/* Panel follows rail position */
	.dashboard-content.content-right {
		flex-direction: row-reverse;
	}

	.dashboard-content.content-top {
		flex-direction: column;
	}

	.dashboard-content.content-bottom {
		flex-direction: column-reverse;
	}

	.tool-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--palantir-bg-app);
	}

	/* Bottom panel tabs — shows only the active tab label */
	.bottom-panel-tabs {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 32px;
		min-height: 32px;
		background: var(--palantir-bg-chrome, #0e1116);
		border-bottom: 1px solid var(--palantir-border-subtle, #1e2228);
		padding: 0 var(--space-2, 0.5rem);
	}

	.tab-list {
		display: flex;
		align-items: center;
		gap: 0;
		height: 100%;
	}

	.panel-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 100%;
		box-sizing: border-box;
		padding: 0 12px;
		margin: 0;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--palantir-text-tertiary, #5f6368);
		font-size: 12px;
		line-height: 1;
		font-family: var(--font-sans, system-ui);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 0.1s,
			bg 0.1s;
	}

	.panel-tab:hover {
		color: var(--palantir-text-secondary, #9aa0a6);
		background: var(--palantir-bg-hover, rgba(255, 255, 255, 0.04));
	}

	.panel-tab.active {
		color: var(--palantir-text-primary, #e8eaed);
		border-bottom-color: var(--palantir-accent, #4a9eff);
	}

	.panel-tab svg {
		display: block;
		flex-shrink: 0;
	}

	.tab-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: var(--palantir-text-tertiary, #5f6368);
		cursor: pointer;
		border-radius: var(--radius-sm, 4px);
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-close-btn:hover {
		background: var(--palantir-bg-hover, rgba(255, 255, 255, 0.06));
		color: var(--palantir-text-secondary, #9aa0a6);
	}

	.bottom-panel-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.tab-pane {
		display: none;
		flex: 1;
		flex-direction: column;
		overflow: hidden;
		min-height: 0;
	}

	.tab-pane.tab-active {
		display: flex;
	}
</style>
