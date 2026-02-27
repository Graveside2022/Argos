<script lang="ts">
	import {
		setHeightAgl,
		setHeightAglMode,
		setViewshedRadius,
		viewshedComputedAgl,
		viewshedStore
	} from '$lib/stores/dashboard/viewshed-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { VIEWSHED_LIMITS } from '$lib/types/viewshed';

	let isAuto = $derived($viewshedStore.heightAglMode === 'auto');
	let hasGpsAltitude = $derived($gpsStore.status.altitude !== null);

	// Logarithmic mapping for radius slider
	const LOG_MIN = Math.log10(VIEWSHED_LIMITS.RADIUS_MIN_M);
	const LOG_MAX = Math.log10(VIEWSHED_LIMITS.RADIUS_MAX_M);

	function radiusToSlider(radiusM: number): number {
		return (Math.log10(radiusM) - LOG_MIN) / (LOG_MAX - LOG_MIN);
	}
	function sliderToRadius(value: number): number {
		return Math.round(10 ** (LOG_MIN + value * (LOG_MAX - LOG_MIN)));
	}

	function formatRadius(m: number): string {
		return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
	}

	function aglSuffix(): string {
		if (!isAuto) return '';
		return hasGpsAltitude ? ' (GPS)' : ' (no GPS)';
	}

	function formatAglReadout(): string {
		const value =
			isAuto && hasGpsAltitude && $viewshedComputedAgl !== null
				? $viewshedComputedAgl
				: $viewshedStore.heightAglM;
		return `${value.toFixed(1)} m${aglSuffix()}`;
	}
</script>

<section class="panel-section">
	<div class="section-label">VIEWSHED PARAMETERS</div>

	<!-- Height AGL mode toggle -->
	<div class="viewshed-param">
		<div class="param-name">Height AGL Source</div>
		<div class="freq-source-row">
			<button class="freq-btn" class:active={isAuto} onclick={() => setHeightAglMode('auto')}>
				Auto (GPS)
			</button>
			<button
				class="freq-btn"
				class:active={!isAuto}
				onclick={() => setHeightAglMode('custom')}
			>
				Custom
			</button>
		</div>
	</div>

	<!-- Height AGL slider -->
	<div class="viewshed-param">
		<div class="param-header">
			<span class="param-name">Height AGL</span>
			<span class="param-readout">{formatAglReadout()}</span>
		</div>
		<input
			type="range"
			class="viewshed-slider"
			min={VIEWSHED_LIMITS.HEIGHT_AGL_MIN_M}
			max={VIEWSHED_LIMITS.HEIGHT_AGL_MAX_M}
			step="0.5"
			value={$viewshedStore.heightAglM}
			oninput={(e) => setHeightAgl(Number((e.target as HTMLInputElement).value))}
			disabled={isAuto && hasGpsAltitude}
		/>
		{#if isAuto && !hasGpsAltitude}
			<div class="fallback-hint">No GPS altitude — using manual</div>
		{/if}
	</div>

	<div class="viewshed-param">
		<div class="param-header">
			<span class="param-name">Radius</span>
			<span class="param-readout">{formatRadius($viewshedStore.radiusM)}</span>
		</div>
		<input
			type="range"
			class="viewshed-slider"
			min="0"
			max="1"
			step="0.005"
			value={radiusToSlider($viewshedStore.radiusM)}
			oninput={(e) =>
				setViewshedRadius(sliderToRadius(Number((e.target as HTMLInputElement).value)))}
		/>
	</div>
</section>

<style>
	@import '../map-settings-shared.css';

	.viewshed-param {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.param-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.param-name {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary);
	}
	.param-readout {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}
	.viewshed-slider {
		width: 100%;
		height: 4px;
		accent-color: var(--primary);
		cursor: pointer;
	}
	.viewshed-slider:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.fallback-hint {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		color: var(--warning, #d4a054);
		font-style: italic;
	}
</style>
