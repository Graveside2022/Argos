<script lang="ts">
	import { type VisibilityMode, visibilityMode } from '$lib/map/visibility-engine';
	import {
		activeBands,
		layerVisibility,
		toggleBand,
		toggleLayerVisibility
	} from '$lib/stores/dashboard/dashboard-store';
	import { signalBands } from '$lib/utils/signal-utils';

	function setVisibilityMode(mode: VisibilityMode) {
		visibilityMode.set(mode);
	}
</script>

<div class="layers-view">
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
	@import './map-settings-shared.css';

	.layers-view {
		display: flex;
		flex-direction: column;
	}
</style>
