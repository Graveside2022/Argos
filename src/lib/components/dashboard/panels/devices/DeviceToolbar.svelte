<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Band filter chips, back button use custom 24x20px sizing incompatible with shadcn Button -->
<script lang="ts">
	import Input from '$lib/components/ui/input/input.svelte';
	import { signalBands } from '$lib/utils/signal-utils';

	interface Props {
		deviceCount: number;
		renderedCount?: number;
		isolatedMAC: string | null;
		searchQuery: string;
		activeBands: Set<string>;
		shouldHideNoSignal: boolean;
		shouldShowOnlyWithClients: boolean;
		apsWithClientsCount: number;
		onClearIsolation: () => void;
		onSearchChange: (query: string) => void;
		onToggleBand: (key: string) => void;
		onToggleNoSignal: () => void;
		onToggleOnlyWithClients: () => void;
	}

	let {
		deviceCount,
		renderedCount,
		isolatedMAC,
		searchQuery,
		activeBands,
		shouldHideNoSignal,
		shouldShowOnlyWithClients,
		apsWithClientsCount,
		onClearIsolation,
		onSearchChange,
		onToggleBand,
		onToggleNoSignal,
		onToggleOnlyWithClients
	}: Props = $props();
</script>

<div class="panel-toolbar">
	<span class="panel-title">DEVICES</span>
	<span class="device-count">{deviceCount}</span>
	{#if renderedCount !== undefined && renderedCount < deviceCount}
		<span class="cap-badge">showing {renderedCount}</span>
	{/if}

	{#if isolatedMAC}
		<button class="back-btn" onclick={onClearIsolation} title="Back to all devices">
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
			>
			All
		</button>
	{/if}

	<div class="toolbar-separator"></div>

	<Input
		class="toolbar-search h-7 text-xs"
		type="text"
		placeholder="Search MAC, SSID, manufacturer..."
		value={searchQuery}
		oninput={(e) => onSearchChange(e.currentTarget.value)}
	/>

	<div class="toolbar-separator"></div>

	<div class="band-filters">
		{#each signalBands as band (band.key)}
			<button
				class="band-chip"
				class:hidden-band={!activeBands.has(band.key)}
				onclick={() => onToggleBand(band.key)}
				title={band.label}
			>
				<span class="band-dot" style="background: var({band.cssVar})"></span>
			</button>
		{/each}
		<button
			class="band-chip no-signal-chip"
			class:hidden-band={shouldHideNoSignal}
			onclick={onToggleNoSignal}
			title={shouldHideNoSignal
				? 'Show devices without signal'
				: 'Hide devices without signal'}
		>
			<span class="no-signal-label">--</span>
		</button>
		<button
			class="band-chip multi-client-chip"
			class:active-filter={shouldShowOnlyWithClients}
			onclick={onToggleOnlyWithClients}
			title={shouldShowOnlyWithClients
				? 'Show all devices'
				: 'Show only APs with connected clients'}
		>
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="14" /><line
					x1="12"
					y1="14"
					x2="6"
					y2="20"
				/><line x1="12" y1="14" x2="18" y2="20" /></svg
			>
			{#if apsWithClientsCount > 0}
				<span class="filter-badge">{apsWithClientsCount}</span>
			{/if}
		</button>
	</div>
</div>

<style>
	.panel-toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--palantir-border-subtle);
		flex-shrink: 0;
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.device-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-accent);
		font-variant-numeric: tabular-nums;
	}

	.cap-badge {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--palantir-text-tertiary);
		letter-spacing: 0.5px;
	}

	.back-btn {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: color-mix(in srgb, var(--palantir-accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--palantir-accent) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--palantir-accent);
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
		padding: 2px 6px;
		cursor: pointer;
		letter-spacing: var(--letter-spacing-wide);
	}

	.back-btn:hover {
		background: color-mix(in srgb, var(--palantir-accent) 20%, transparent);
	}

	.toolbar-separator {
		width: 1px;
		height: 16px;
		background: var(--palantir-border-subtle);
		flex-shrink: 0;
	}

	.band-filters {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		flex-shrink: 0;
	}

	.band-chip {
		width: 24px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.band-chip.hidden-band {
		opacity: 0.25;
	}

	.band-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.no-signal-chip {
		margin-left: 2px;
	}

	.no-signal-label {
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
		color: var(--palantir-text-tertiary);
		line-height: 1;
	}

	.multi-client-chip {
		position: relative;
		width: auto;
		padding: 0 4px;
		gap: 2px;
		color: var(--palantir-text-tertiary);
	}

	.multi-client-chip.active-filter {
		opacity: 1;
		border-color: var(--palantir-accent);
		color: var(--palantir-accent);
		background: color-mix(in srgb, var(--palantir-accent) 10%, transparent);
	}

	.filter-badge {
		font-family: var(--font-mono);
		font-size: 8px;
		color: var(--palantir-accent);
		line-height: 1;
	}
</style>
