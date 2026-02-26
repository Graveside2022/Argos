<script lang="ts">
	import {
		setHeightAgl,
		setViewshedRadius,
		viewshedStore
	} from '$lib/stores/dashboard/viewshed-store';
	import { VIEWSHED_LIMITS } from '$lib/types/viewshed';

	interface Props {
		isRfCapped?: boolean;
		effectiveRadiusM?: number | null;
	}

	let { isRfCapped = false, effectiveRadiusM = null }: Props = $props();

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
</script>

<section class="panel-section">
	<div class="section-label">VIEWSHED PARAMETERS</div>

	<div class="viewshed-param">
		<div class="param-header">
			<span class="param-name">Height AGL</span>
			<span class="param-readout">{$viewshedStore.heightAglM.toFixed(1)} m</span>
		</div>
		<input
			type="range"
			class="viewshed-slider"
			min={VIEWSHED_LIMITS.HEIGHT_AGL_MIN_M}
			max={VIEWSHED_LIMITS.HEIGHT_AGL_MAX_M}
			step="0.5"
			value={$viewshedStore.heightAglM}
			oninput={(e) => setHeightAgl(Number((e.target as HTMLInputElement).value))}
		/>
	</div>

	<div class="viewshed-param">
		<div class="param-header">
			<span class="param-name">Radius</span>
			<span class="param-readout">
				{formatRadius(effectiveRadiusM ?? $viewshedStore.radiusM)}
				{#if isRfCapped}<span class="rf-capped-badge">RF CAPPED</span>{/if}
			</span>
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
	.rf-capped-badge {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		color: var(--warning);
		padding: 1px 4px;
		border: 1px solid var(--warning);
		border-radius: 2px;
		margin-left: 4px;
	}
</style>
