<script lang="ts">
	import Input from '$lib/components/ui/input/input.svelte';
	import { type VisibilityMode, visibilityMode } from '$lib/map/VisibilityEngine';
	import {
		activeBands,
		layerVisibility,
		toggleBand,
		toggleLayerVisibility
	} from '$lib/stores/dashboard/dashboard-store';
	import {
		DEFAULT_SATELLITE_SOURCE,
		DEFAULT_VECTOR_SOURCE,
		mapSettings
	} from '$lib/stores/dashboard/map-settings-store';
	import { signalBands } from '$lib/utils/signal-utils';

	let customUrl = $state('');
	const stadiaStore = mapSettings.stadiaAvailable;
	let stadiaAvailable = $derived($stadiaStore);

	function selectVector() {
		mapSettings.setProvider(DEFAULT_VECTOR_SOURCE);
	}

	function selectSatellite() {
		mapSettings.setProvider(DEFAULT_SATELLITE_SOURCE);
	}

	function applyCustom() {
		if (!customUrl) return;
		mapSettings.setProvider({
			name: 'Custom',
			type: 'satellite',
			url: customUrl,
			attribution: 'Custom'
		});
	}

	function setVisibilityMode(mode: VisibilityMode) {
		visibilityMode.set(mode);
	}
</script>

<div class="layers-panel">
	<header class="panel-header">
		<span class="panel-title">LAYERS</span>
	</header>

	<!-- Map Provider -->
	<section class="panel-section">
		<div class="section-label">MAP PROVIDER</div>
		<div class="provider-grid">
			<button
				class="provider-btn"
				class:active={$mapSettings.type === 'vector'}
				onclick={selectVector}
				disabled={!stadiaAvailable}
				title={!stadiaAvailable ? 'Requires Stadia Maps API key' : ''}
			>
				<span class="provider-icon vector"></span>
				<span class="provider-name">Tactical</span>
			</button>
			<button
				class="provider-btn"
				class:active={$mapSettings.name === 'Satellite Hybrid'}
				onclick={selectSatellite}
			>
				<span class="provider-icon satellite"></span>
				<span class="provider-name">Satellite</span>
			</button>
		</div>

		<div class="custom-input-row">
			<Input
				type="text"
				placeholder="Custom XYZ URL..."
				bind:value={customUrl}
				class="flex-1 h-7 text-xs"
			/>
			<button class="apply-btn" onclick={applyCustom}>Set</button>
		</div>
	</section>

	<!-- Visibility Filter -->
	<section class="panel-section">
		<div class="section-label">VISIBILITY FILTER</div>
		<div class="vis-options">
			<button
				class="vis-btn"
				class:active={$visibilityMode === 'dynamic'}
				onclick={() => setVisibilityMode('dynamic')}
				title="Auto-squelch noise"
			>
				<span class="vis-icon">D</span>
				<span class="vis-name">Dynamic</span>
			</button>
			<button
				class="vis-btn"
				class:active={$visibilityMode === 'all'}
				onclick={() => setVisibilityMode('all')}
				title="Show all detections"
			>
				<span class="vis-icon">A</span>
				<span class="vis-name">All</span>
			</button>
			<button
				class="vis-btn"
				class:active={$visibilityMode === 'manual'}
				onclick={() => setVisibilityMode('manual')}
				title="Manually promoted only"
			>
				<span class="vis-icon">M</span>
				<span class="vis-name">Manual</span>
			</button>
		</div>
	</section>

	<!-- Map Layers -->
	<section class="panel-section">
		<div class="section-label">MAP LAYERS</div>

		<label class="toggle-row">
			<span class="toggle-label">Device Dots</span>
			<button
				class="toggle-switch"
				class:on={$layerVisibility.deviceDots}
				onclick={() => toggleLayerVisibility('deviceDots')}
				role="switch"
				aria-checked={$layerVisibility.deviceDots}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Military Symbols</span>
			<button
				class="toggle-switch"
				class:on={$layerVisibility.milSyms}
				onclick={() => toggleLayerVisibility('milSyms')}
				role="switch"
				aria-checked={$layerVisibility.milSyms}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Connections</span>
			<button
				class="toggle-switch"
				class:on={$layerVisibility.connectionLines}
				onclick={() => toggleLayerVisibility('connectionLines')}
				role="switch"
				aria-checked={$layerVisibility.connectionLines}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Cell Towers</span>
			<button
				class="toggle-switch"
				class:on={$layerVisibility.cellTowers}
				onclick={() => toggleLayerVisibility('cellTowers')}
				role="switch"
				aria-checked={$layerVisibility.cellTowers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Signal Markers</span>
			<button
				class="toggle-switch"
				class:on={$layerVisibility.signalMarkers}
				onclick={() => toggleLayerVisibility('signalMarkers')}
				role="switch"
				aria-checked={$layerVisibility.signalMarkers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>

	<!-- Signal Strength Filter -->
	<section class="panel-section">
		<div class="section-label">SIGNAL STRENGTH</div>

		{#each signalBands as band (band.key)}
			<label class="toggle-row">
				<div class="band-label">
					<span class="band-dot" style="background: var({band.cssVar})"></span>
					<span class="toggle-label">{band.name}</span>
					<span class="band-range">{band.range}</span>
				</div>
				<button
					class="toggle-switch"
					class:on={$activeBands.has(band.key)}
					onclick={() => toggleBand(band.key)}
					role="switch"
					aria-checked={$activeBands.has(band.key)}
				>
					<span class="toggle-knob"></span>
				</button>
			</label>
		{/each}

		<label class="toggle-row">
			<div class="band-label">
				<span class="band-dot" style="background: var(--muted-foreground)"></span>
				<span class="toggle-label">No RSSI</span>
			</div>
			<button
				class="toggle-switch"
				class:on={$activeBands.has('none')}
				onclick={() => toggleBand('none')}
				role="switch"
				aria-checked={$activeBands.has('none')}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>
	</section>
</div>

<style>
	.layers-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.panel-section {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		cursor: pointer;
	}

	.toggle-label {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.band-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.band-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.band-range {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}

	/* Toggle switch */
	.toggle-switch {
		width: 32px;
		height: 18px;
		border-radius: 9px;
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-default);
		cursor: pointer;
		position: relative;
		transition: all 0.15s ease;
		flex-shrink: 0;
		padding: 0;
	}

	.toggle-switch.on {
		background: var(--palantir-accent);
		border-color: var(--palantir-accent);
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--palantir-text-secondary);
		transition:
			transform 0.15s ease,
			background 0.15s ease;
	}

	.toggle-switch.on .toggle-knob {
		transform: translateX(14px);
		background: var(--palantir-text-on-accent);
	}

	/* Map Provider Styles */
	.provider-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.provider-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px;
		background: var(--palantir-bg-subtle);
		border: 1px solid var(--palantir-border-default);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.provider-btn:hover:not(:disabled) {
		background: var(--palantir-bg-hover);
	}

	.provider-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.provider-btn.active {
		background: color-mix(in srgb, var(--palantir-accent) 15%, transparent);
		border-color: var(--palantir-accent);
	}

	.provider-icon {
		width: 32px;
		height: 32px;
		border-radius: 4px;
		background-size: cover;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.provider-icon.vector {
		background: linear-gradient(135deg, var(--color-card) 0%, var(--color-muted) 100%);
	}

	.provider-icon.satellite {
		background: linear-gradient(135deg, var(--color-muted) 0%, var(--color-primary) 100%);
	}

	.provider-name {
		font-size: 10px;
		color: var(--palantir-text-primary);
	}

	.custom-input-row {
		display: flex;
		gap: 4px;
		margin-top: 4px;
	}

	.custom-input-row input {
		flex: 1;
		background: var(--palantir-bg-default);
		border: 1px solid var(--palantir-border-default);
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 11px;
		color: var(--palantir-text-primary);
	}

	.apply-btn {
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-default);
		color: var(--palantir-text-primary);
		font-size: 10px;
		padding: 0 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	/* Visibility Filter Styles */
	.vis-options {
		display: flex;
		gap: 4px;
	}

	.vis-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px;
		background: transparent;
		border: 1px solid var(--palantir-border-default);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.vis-btn:hover {
		background: var(--palantir-bg-hover);
	}

	.vis-btn.active {
		background: color-mix(in srgb, var(--palantir-accent) 15%, transparent);
		border-color: var(--palantir-accent);
	}

	.vis-icon {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background: var(--palantir-bg-elevated);
		color: var(--palantir-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 700;
	}

	.vis-btn.active .vis-icon {
		background: var(--palantir-accent);
		color: var(--palantir-text-on-accent);
	}

	.vis-name {
		font-size: 9px;
		color: var(--palantir-text-secondary);
	}

	.vis-btn.active .vis-name {
		color: var(--palantir-text-primary);
	}
</style>
