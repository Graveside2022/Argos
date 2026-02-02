<script lang="ts">
	import { activePanel } from '$lib/stores/dashboard/dashboardStore';
	import OverviewPanel from './panels/OverviewPanel.svelte';
	import ToolsPanel from './panels/ToolsPanel.svelte';
	import DevicesPanel from './panels/DevicesPanel.svelte';
	import LayersPanel from './panels/LayersPanel.svelte';
	import SettingsPanel from './panels/SettingsPanel.svelte';

	$: isOpen = $activePanel !== null;
</script>

<aside class="panel-container" class:open={isOpen}>
	{#if isOpen}
		<div class="panel-content">
			{#if $activePanel === 'overview'}
				<OverviewPanel />
			{:else if $activePanel === 'tools'}
				<ToolsPanel />
			{:else if $activePanel === 'devices'}
				<DevicesPanel />
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
		background: linear-gradient(
			to bottom,
			rgba(26, 29, 35, 0.98) 0%,
			rgba(22, 24, 29, 0.98) 100%
		);
		backdrop-filter: blur(8px);
		border-right: 1px solid rgba(74, 158, 255, 0.12);
		box-shadow:
			2px 0 8px rgba(0, 0, 0, 0.3),
			inset 1px 0 0 rgba(255, 255, 255, 0.03);
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
