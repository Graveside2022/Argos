<script lang="ts">
	import type { HardwareDetails } from './types';

	interface Props {
		kismetStatus: string;
		kismetDeviceCount: number;
		gpsHasFix: boolean;
		gpsSatellites: number;
		takStatus: string;
		takMessageCount: number;
		gpsDetails: HardwareDetails['gps'] | undefined;
		expandedRow: string | null;
		onToggleExpand: (id: string) => void;
		onOpenKismet: () => void;
		onOpenTakConfig: () => void;
	}

	let {
		kismetStatus,
		kismetDeviceCount,
		gpsHasFix,
		gpsSatellites,
		takStatus,
		takMessageCount,
		gpsDetails,
		expandedRow,
		onToggleExpand,
		onOpenKismet,
		onOpenTakConfig
	}: Props = $props();
</script>

<section class="panel-section">
	<div class="section-label">SERVICES</div>
	<button class="scan-row clickable" onclick={onOpenKismet}>
		<span class="scan-dot" class:active={kismetStatus === 'running'}></span>
		<span class="scan-name">Kismet WiFi</span>
		{#if kismetStatus === 'running'}
			<span class="scan-count">{kismetDeviceCount}</span>
		{:else}
			<span class="scan-status-text">stopped</span>
		{/if}
		<span class="row-chevron">&#8250;</span>
	</button>
	<button class="scan-row clickable" onclick={() => onToggleExpand('gps')}>
		<span class="scan-dot" class:active={gpsHasFix}></span>
		<span class="scan-name">GPS</span>
		{#if gpsHasFix}
			<span class="scan-count">{gpsSatellites} sats</span>
		{:else}
			<span class="scan-status-text">no fix</span>
		{/if}
		<span class="row-chevron" class:expanded={expandedRow === 'gps'}>&#8250;</span>
	</button>
	{#if expandedRow === 'gps' && gpsDetails}
		<div class="detail-panel">
			{#if gpsDetails.device}
				<div class="detail-row">
					<span class="detail-key">Device</span>
					<span class="detail-val">{gpsDetails.device}</span>
				</div>
			{/if}
			{#if gpsDetails.protocol}
				<div class="detail-row">
					<span class="detail-key">Protocol</span>
					<span class="detail-val">{gpsDetails.protocol}</span>
				</div>
			{/if}
			{#if gpsDetails.baudRate}
				<div class="detail-row">
					<span class="detail-key">Baud Rate</span>
					<span class="detail-val">{gpsDetails.baudRate}</span>
				</div>
			{/if}
			{#if gpsDetails.usbAdapter}
				<div class="detail-row">
					<span class="detail-key">Adapter</span>
					<span class="detail-val">{gpsDetails.usbAdapter}</span>
				</div>
			{/if}
			{#if gpsDetails.gpsdVersion}
				<div class="detail-row">
					<span class="detail-key">GPSD</span>
					<span class="detail-val">v{gpsDetails.gpsdVersion}</span>
				</div>
			{/if}
		</div>
	{/if}
	<button class="scan-row clickable" onclick={onOpenTakConfig}>
		<span class="scan-dot" class:active={takStatus === 'connected'}></span>
		<span class="scan-name">TAK Server</span>
		{#if takStatus === 'connected'}
			<span class="scan-count">{takMessageCount} msg</span>
		{:else}
			<span class="scan-status-text">{takStatus}</span>
		{/if}
		<span class="row-chevron">&#8250;</span>
	</button>
</section>

<style>
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

	.scan-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-md);
		width: 100%;
		text-align: left;
	}

	.scan-row.clickable {
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.scan-row.clickable:hover {
		background: var(--palantir-bg-hover);
	}

	.scan-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--palantir-text-tertiary);
		flex-shrink: 0;
	}

	.scan-dot.active {
		background: var(--palantir-success);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-success) 50%, transparent);
	}

	.scan-name {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
		flex: 1;
	}

	.scan-count {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--palantir-accent);
		font-variant-numeric: tabular-nums;
	}

	.scan-status-text {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}

	.row-chevron {
		font-size: var(--text-base);
		color: var(--palantir-text-tertiary);
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}

	.row-chevron.expanded {
		transform: rotate(90deg);
	}

	.detail-panel {
		margin-top: calc(-1 * var(--space-2));
		padding: var(--space-3);
		background: var(--palantir-bg-elevated);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		border-top: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.detail-key {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		white-space: nowrap;
	}

	.detail-val {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		text-align: right;
		word-break: break-all;
	}
</style>
