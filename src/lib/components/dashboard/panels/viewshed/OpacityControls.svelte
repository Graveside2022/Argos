<script lang="ts">
	import {
		setAdjustTogether,
		setGreenOpacity,
		setRedOpacity,
		viewshedStore
	} from '$lib/stores/dashboard/viewshed-store';
</script>

<section class="panel-section">
	<div class="section-label">OVERLAY OPACITY</div>

	<div class="opacity-row">
		<span class="opacity-label visible">Visible</span>
		<input
			type="range"
			class="opacity-slider green"
			min="0"
			max="1"
			step="0.01"
			value={$viewshedStore.greenOpacity}
			oninput={(e) => setGreenOpacity(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="opacity-readout">{Math.round($viewshedStore.greenOpacity * 100)}%</span>
	</div>

	<div class="opacity-row">
		<span class="opacity-label obstructed">Obstructed</span>
		<input
			type="range"
			class="opacity-slider red"
			min="0"
			max="1"
			step="0.01"
			value={$viewshedStore.redOpacity}
			oninput={(e) => setRedOpacity(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="opacity-readout">{Math.round($viewshedStore.redOpacity * 100)}%</span>
	</div>

	<label class="toggle-row">
		<span class="toggle-label">Adjust Together</span>
		<button
			class="toggle-switch"
			class:on={$viewshedStore.adjustTogether}
			onclick={() => setAdjustTogether(!$viewshedStore.adjustTogether)}
			role="switch"
			aria-checked={$viewshedStore.adjustTogether}
		>
			<span class="toggle-knob"></span>
		</button>
	</label>
</section>

<style>
	@import '../map-settings-shared.css';

	.opacity-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.opacity-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		min-width: 72px;
	}
	.opacity-label.visible {
		color: #00c800;
	}
	.opacity-label.obstructed {
		color: #c80000;
	}
	.opacity-slider {
		flex: 1;
		height: 4px;
		cursor: pointer;
	}
	.opacity-slider.green {
		accent-color: #00c800;
	}
	.opacity-slider.red {
		accent-color: #c80000;
	}
	.opacity-readout {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		min-width: 32px;
		text-align: right;
	}
</style>
