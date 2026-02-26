<script lang="ts">
	import { getRadioColor } from './map-helpers';

	interface Props {
		content: {
			radio: string;
			mcc: number;
			mnc: number;
			lac: number;
			ci: number;
			range: number;
			samples: number;
			avgSignal: number;
		};
	}

	let { content }: Props = $props();
</script>

<div class="map-popup">
	<div class="popup-title tower-title">
		<span class="tower-radio-dot" style="background: {getRadioColor(content.radio)}"></span>
		{content.radio} Tower
	</div>
	<div class="popup-row">
		<span class="popup-label">MCC</span>
		<span class="popup-value">{content.mcc}</span>
	</div>
	<div class="popup-row">
		<span class="popup-label">MNC</span>
		<span class="popup-value">{content.mnc}</span>
	</div>
	<div class="popup-row">
		<span class="popup-label">LAC</span>
		<span class="popup-value">{content.lac}</span>
	</div>
	<div class="popup-row">
		<span class="popup-label">CELL ID</span>
		<span class="popup-value">{content.ci}</span>
	</div>
	<div class="popup-divider"></div>
	<div class="popup-row">
		<span class="popup-label">RANGE</span>
		<span class="popup-value">
			{content.range >= 1000
				? `${(content.range / 1000).toFixed(1)} km`
				: `${content.range} m`}
		</span>
	</div>
	<div class="popup-row">
		<span class="popup-label">SAMPLES</span>
		<span class="popup-value">{content.samples.toLocaleString()}</span>
	</div>
	{#if content.avgSignal}
		<div class="popup-row">
			<span class="popup-label">AVG SIGNAL</span>
			<span class="popup-value">{content.avgSignal} dBm</span>
		</div>
	{/if}
</div>

<style>
	.map-popup {
		min-width: 180px;
	}

	.popup-title {
		font-weight: 600;
		font-size: var(--text-brand);
		margin-bottom: 8px;
		color: var(--foreground);
	}

	.popup-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		padding: 2px 0;
	}

	.popup-label {
		color: var(--foreground-secondary);
		letter-spacing: 0.05em;
	}

	.popup-value {
		color: var(--foreground-muted);
		font-family: var(--font-primary, monospace);
	}

	.popup-divider {
		border-top: 1px solid var(--border);
		margin: 4px 0;
	}

	.tower-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.tower-radio-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
