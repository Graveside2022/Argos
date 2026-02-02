<script lang="ts">
	import { signalBands } from '$lib/utils/signalUtils';

	// Layer visibility state
	let layers = {
		deviceDots: true,
		cellTowers: false,
		signalMarkers: true,
		accuracyCircle: true
	};

	// Signal band filter state
	let activeBands = new Set(signalBands.map((b) => b.key));

	function toggleLayer(key: keyof typeof layers) {
		layers[key] = !layers[key];
		layers = { ...layers };
	}

	function toggleBand(key: string) {
		if (activeBands.has(key)) {
			activeBands.delete(key);
		} else {
			activeBands.add(key);
		}
		activeBands = new Set(activeBands);
	}
</script>

<div class="layers-panel">
	<header class="panel-header">
		<span class="panel-title">LAYERS</span>
	</header>

	<!-- Map Layers -->
	<section class="panel-section">
		<div class="section-label">MAP LAYERS</div>

		<label class="toggle-row">
			<span class="toggle-label">Device Dots</span>
			<button
				class="toggle-switch"
				class:on={layers.deviceDots}
				on:click={() => toggleLayer('deviceDots')}
				role="switch"
				aria-checked={layers.deviceDots}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Cell Towers</span>
			<button
				class="toggle-switch"
				class:on={layers.cellTowers}
				on:click={() => toggleLayer('cellTowers')}
				role="switch"
				aria-checked={layers.cellTowers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">Signal Markers</span>
			<button
				class="toggle-switch"
				class:on={layers.signalMarkers}
				on:click={() => toggleLayer('signalMarkers')}
				role="switch"
				aria-checked={layers.signalMarkers}
			>
				<span class="toggle-knob"></span>
			</button>
		</label>

		<label class="toggle-row">
			<span class="toggle-label">GPS Accuracy</span>
			<button
				class="toggle-switch"
				class:on={layers.accuracyCircle}
				on:click={() => toggleLayer('accuracyCircle')}
				role="switch"
				aria-checked={layers.accuracyCircle}
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
					<span class="toggle-label">{band.label}</span>
				</div>
				<button
					class="toggle-switch"
					class:on={activeBands.has(band.key)}
					on:click={() => toggleBand(band.key)}
					role="switch"
					aria-checked={activeBands.has(band.key)}
				>
					<span class="toggle-knob"></span>
				</button>
			</label>
		{/each}
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
</style>
