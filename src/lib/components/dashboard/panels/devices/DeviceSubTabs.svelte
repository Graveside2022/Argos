<script lang="ts">
	interface TabDef {
		id: string;
		label: string;
	}

	interface Props {
		activeTab: string;
		counts: Record<string, number>;
		tabs: TabDef[];
		onTabChange: (tab: string) => void;
	}

	let { activeTab, counts, tabs, onTabChange }: Props = $props();
</script>

<div class="sub-tab-bar" role="tablist">
	{#each tabs as tab (tab.id)}
		{@const count = counts[tab.id] ?? 0}
		<button
			class="sub-tab"
			class:active={activeTab === tab.id}
			class:has-items={tab.id !== 'all' && tab.id !== 'whitelist' && count > 0}
			role="tab"
			aria-selected={activeTab === tab.id}
			onclick={() => onTabChange(tab.id)}
		>
			<span class="sub-tab-label">{tab.label}</span>
			{#if tab.id !== 'whitelist'}
				<span class="sub-tab-count">{count}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.sub-tab-bar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 var(--space-3);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--card);
		overflow-x: auto;
	}

	.sub-tab {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--foreground-secondary);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 1px;
		cursor: pointer;
		transition:
			color 0.1s ease,
			border-color 0.1s ease;
		white-space: nowrap;
	}

	.sub-tab:hover {
		color: var(--foreground-muted);
	}

	.sub-tab.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
	}

	.sub-tab.has-items:not(.active) {
		color: var(--warning, #d4a054);
	}

	.sub-tab-count {
		font-size: 9px;
		font-variant-numeric: tabular-nums;
		color: inherit;
		opacity: 0.7;
	}

	.sub-tab.active .sub-tab-count {
		opacity: 1;
	}
</style>
