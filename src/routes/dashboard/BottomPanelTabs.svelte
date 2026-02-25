<!--
  Bottom panel tab bar for the dashboard.
  Tab order per spec-018: Terminal, Chat, Logs, Captures, Devices.
  Geist font labels with accent-colored active indicator.
-->
<script lang="ts">
	import { activeBottomTab, closeBottomPanel } from '$lib/stores/dashboard/dashboard-store';

	interface Props {
		activeTab: string | null;
	}

	let { activeTab }: Props = $props();

	const tabs = [
		{ id: 'terminal', label: 'Terminal', icon: 'M4 17l6-6-6-6M12 19h8' },
		{
			id: 'chat',
			label: 'Chat',
			icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
		},
		{
			id: 'logs',
			label: 'Logs',
			icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8'
		},
		{
			id: 'captures',
			label: 'Captures',
			icon: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8'
		},
		{
			id: 'devices',
			label: 'Devices',
			icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'
		}
	] as const;
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
				{tab.label}
			</button>
		{/each}
	</div>
	<button class="tab-close-btn" title="Close panel" onclick={closeBottomPanel}>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>
</div>

<style>
	.bottom-panel-tabs {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 32px;
		min-height: 32px;
		background: var(--background);
		border-bottom: 1px solid var(--border);
		padding: 0 8px;
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
		color: var(--muted-foreground);
		font-size: 14px;
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
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 4px;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.tab-close-btn:hover {
		background: var(--surface-hover);
		color: var(--foreground-muted);
	}
</style>
