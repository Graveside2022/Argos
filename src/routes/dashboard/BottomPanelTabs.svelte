<!--
  Bottom panel tab bar for the dashboard.
  Tab order: Terminal (+), Chat, Logs, IMSI Captures, Devices.
  Always visible — chevron toggles collapse/expand (panel never fully disappears).
-->
<script lang="ts">
	import {
		activeBottomTab,
		closeBottomPanel,
		isBottomPanelOpen
	} from '$lib/stores/dashboard/dashboard-store';

	interface Props {
		activeTab: string | null;
	}

	let { activeTab }: Props = $props();

	type TabId = 'terminal' | 'chat' | 'logs' | 'captures' | 'devices';

	// Lucide path data for tab icons — only Terminal keeps the >_ icon; others are text-only
	const tabs: { id: TabId; label: string; icon: string | null }[] = [
		{ id: 'terminal', label: 'Terminal', icon: 'M4 17l6-6-6-6M12 19h8' },
		{ id: 'chat', label: 'Chat', icon: null },
		{ id: 'logs', label: 'Logs', icon: null },
		{ id: 'captures', label: 'IMSI Captures', icon: null },
		{ id: 'devices', label: 'Devices', icon: null }
	];

	// Toggle: if panel is open, collapse it; if collapsed, reopen to terminal tab
	function toggleCollapse() {
		if ($isBottomPanelOpen) {
			closeBottomPanel();
		} else {
			activeBottomTab.set('terminal');
		}
	}
</script>

<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Tab buttons use custom styling tightly coupled to panel layout; shadcn Tabs component incompatible with split tab-bar/panel-content architecture -->
<div class="bottom-panel-tabs">
	<div class="tab-list">
		{#each tabs as tab}
			<button
				class="panel-tab"
				class:active={activeTab === tab.id}
				onclick={() => activeBottomTab.set(tab.id)}
			>
				{#if tab.icon}
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
						<path d={tab.icon} />
					</svg>
				{/if}
				{tab.label}
			</button>
			<!-- "+" new session button sits immediately after Terminal tab -->
			{#if tab.id === 'terminal'}
				<button class="tab-new-btn" title="New terminal session">
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19" /><line
							x1="5"
							y1="12"
							x2="19"
							y2="12"
						/>
					</svg>
				</button>
			{/if}
		{/each}
	</div>

	<!-- Flex spacer pushes collapse caret to far right -->
	<div class="tab-spacer"></div>

	<!-- Collapse/expand toggle — shows ▼ when open, ▲ when collapsed -->
	<button
		class="tab-collapse-btn"
		class:collapsed={!$isBottomPanelOpen}
		title={$isBottomPanelOpen ? 'Collapse panel' : 'Expand panel'}
		onclick={toggleCollapse}
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
			<!-- Chevron-down by default; CSS rotates 180° when collapsed to show chevron-up -->
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>
</div>

<style>
	.bottom-panel-tabs {
		display: flex;
		align-items: center;
		height: 40px;
		min-height: 40px;
		background: var(--background);
		border-bottom: 1px solid var(--border);
		padding: 4px 12px;
		gap: 4px;
	}

	.tab-spacer {
		flex: 1;
	}

	.tab-new-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 4px;
		flex-shrink: 0;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-new-btn:hover {
		background: var(--surface-hover);
		color: var(--foreground-muted);
	}

	.tab-list {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 100%;
	}

	.panel-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 100%;
		box-sizing: border-box;
		padding: 6px 12px;
		margin: 0;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--muted-foreground);
		font-size: 14px;
		font-weight: 500;
		line-height: 1;
		font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
		cursor: pointer;
		white-space: nowrap;
		transition:
			color 0.1s,
			background 0.1s;
	}

	.panel-tab:hover {
		color: var(--foreground-muted);
		background: var(--surface-hover);
	}

	.panel-tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
		padding: 6px 12px 4px 12px;
	}

	.panel-tab svg {
		display: block;
		flex-shrink: 0;
	}

	.tab-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 4px;
		transition:
			background 0.1s,
			color 0.1s,
			transform 0.2s ease;
	}

	/* Rotate chevron 180° when panel is collapsed → shows ▲ (pointing up) */
	.tab-collapse-btn.collapsed {
		transform: rotate(180deg);
	}

	.tab-collapse-btn:hover {
		background: var(--surface-hover);
		color: var(--foreground-muted);
	}
</style>
