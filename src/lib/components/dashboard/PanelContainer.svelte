<script lang="ts">
	import { activePanel } from '$lib/stores/dashboard/dashboard-store';
	import OverviewPanel from './panels/OverviewPanel.svelte';
	import ToolsPanel from './panels/ToolsPanel.svelte';
	import LayersPanel from './panels/LayersPanel.svelte';
	import SettingsPanel from './panels/SettingsPanel.svelte';

	let isOpen = $derived($activePanel !== null);
</script>

<aside class="panel-container" class:open={isOpen}>
	{#if isOpen}
		<div class="panel-content">
			{#if $activePanel === 'overview'}
				<OverviewPanel />
			{:else if $activePanel === 'tools'}
				<ToolsPanel />
			{:else if $activePanel === 'layers'}
				<LayersPanel />
			{:else if $activePanel === 'settings'}
				<SettingsPanel />
			{/if}
		</div>
	{/if}
</aside>

<style>
	.panel-container {
		width: 0;
		min-width: 0;
		overflow: hidden;
		background: var(--palantir-bg-surface);
		border-right: 1px solid var(--palantir-border-subtle);
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
		transition:
			width 0.2s ease,
			min-width 0.2s ease;
		display: flex;
		flex-direction: column;
		z-index: 5;
	}

	.panel-container.open {
		width: var(--panel-width);
		min-width: var(--panel-width);
	}

	.panel-content {
		width: var(--panel-width);
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
