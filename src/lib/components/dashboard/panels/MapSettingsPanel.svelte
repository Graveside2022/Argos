<script lang="ts">
	import { ChevronLeft, ChevronRight, Globe, Layers, Radio } from '@lucide/svelte';

	import {
		activeMapSettingsView,
		navigateBackToHub,
		navigateToMapSettingsView
	} from '$lib/stores/dashboard/map-settings-store';

	import LineOfSightView from './LineOfSightView.svelte';
	import MapLayersView from './MapLayersView.svelte';
	import MapProviderView from './MapProviderView.svelte';
</script>

<div class="map-settings-panel">
	{#if $activeMapSettingsView === 'hub'}
		<header class="panel-header">
			<span class="panel-title">MAP SETTINGS</span>
		</header>

		<div class="hub-cards">
			<button class="hub-card" onclick={() => navigateToMapSettingsView('provider')}>
				<div class="hub-card-icon"><Globe size={16} /></div>
				<div class="hub-card-content">
					<span class="hub-card-name">Map Provider</span>
					<span class="hub-card-desc">Tile source & style</span>
				</div>
				<ChevronRight size={14} class="hub-chevron" />
			</button>

			<button class="hub-card" onclick={() => navigateToMapSettingsView('layers')}>
				<div class="hub-card-icon"><Layers size={16} /></div>
				<div class="hub-card-content">
					<span class="hub-card-name">Map Layers</span>
					<span class="hub-card-desc">Visibility & signal filters</span>
				</div>
				<ChevronRight size={14} class="hub-chevron" />
			</button>

			<button class="hub-card" onclick={() => navigateToMapSettingsView('line-of-sight')}>
				<div class="hub-card-icon"><Radio size={16} /></div>
				<div class="hub-card-content">
					<span class="hub-card-name">Line of Sight</span>
					<span class="hub-card-desc">RF range overlay</span>
				</div>
				<ChevronRight size={14} class="hub-chevron" />
			</button>
		</div>
	{:else}
		<header class="panel-header subview-header">
			<button class="back-btn" onclick={navigateBackToHub} aria-label="Back to hub">
				<ChevronLeft size={14} />
			</button>
			<span class="panel-title">
				{#if $activeMapSettingsView === 'provider'}MAP PROVIDER
				{:else if $activeMapSettingsView === 'layers'}MAP LAYERS
				{:else if $activeMapSettingsView === 'line-of-sight'}LINE OF SIGHT
				{/if}
			</span>
		</header>

		<div class="subview-content">
			{#if $activeMapSettingsView === 'provider'}
				<MapProviderView />
			{:else if $activeMapSettingsView === 'layers'}
				<MapLayersView />
			{:else if $activeMapSettingsView === 'line-of-sight'}
				<LineOfSightView />
			{/if}
		</div>
	{/if}
</div>

<style>
	.map-settings-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--border);
	}

	.subview-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.panel-title {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--foreground-secondary, #888888);
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--foreground-secondary, #888888);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.back-btn:hover {
		background: var(--surface-hover, #1e1e1e);
		color: var(--foreground);
	}

	.hub-cards {
		display: flex;
		flex-direction: column;
	}

	.hub-card {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.15s ease;
	}

	.hub-card:hover {
		background: var(--surface-hover, #1e1e1e);
	}

	.hub-card-icon {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--surface-elevated, #151515);
		color: var(--foreground-secondary, #888888);
		flex-shrink: 0;
	}

	.hub-card-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.hub-card-name {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		font-weight: 500;
		color: var(--foreground);
	}

	.hub-card-desc {
		font-size: 10px;
		color: var(--foreground-tertiary, #666666);
	}

	.hub-card :global(.hub-chevron) {
		color: var(--foreground-tertiary, #666666);
		flex-shrink: 0;
	}

	.subview-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}
</style>
