<script lang="ts">
	import type { HardwareDetails, HardwareStatus } from './types';

	interface Props {
		hardwareStatus: HardwareStatus | null;
		hardwareDetails: HardwareDetails | null;
		expandedRow: string | null;
		onToggleExpand: (id: string) => void;
	}

	let { hardwareStatus, hardwareDetails, expandedRow, onToggleExpand }: Props = $props();
</script>

<section class="panel-section">
	<div class="section-label">HARDWARE</div>
	{#if hardwareStatus}
		<!-- HackRF -->
		<button class="scan-row clickable" onclick={() => onToggleExpand('hackrf')}>
			<span
				class="scan-dot"
				class:active={hardwareStatus.hackrf.isDetected && hardwareStatus.hackrf.owner}
				class:standby={hardwareStatus.hackrf.isDetected && !hardwareStatus.hackrf.owner}
			></span>
			<span class="scan-name">HackRF</span>
			{#if !hardwareStatus.hackrf.isDetected}
				<span class="scan-status-text">not found</span>
			{:else if hardwareStatus.hackrf.owner}
				<span class="scan-owner">{hardwareStatus.hackrf.owner}</span>
			{:else}
				<span class="scan-status-text available">available</span>
			{/if}
			<span class="row-chevron" class:expanded={expandedRow === 'hackrf'}>&#8250;</span>
		</button>
		{#if expandedRow === 'hackrf'}
			<div class="detail-panel">
				{#if hardwareDetails?.sdr?.manufacturer}
					<div class="detail-row">
						<span class="detail-key">Make</span>
						<span class="detail-val">{hardwareDetails.sdr.manufacturer}</span>
					</div>
				{/if}
				{#if hardwareDetails?.sdr?.product}
					<div class="detail-row">
						<span class="detail-key">Model</span>
						<span class="detail-val">{hardwareDetails.sdr.product}</span>
					</div>
				{/if}
				{#if hardwareDetails?.sdr?.serial}
					<div class="detail-row">
						<span class="detail-key">Serial</span>
						<span class="detail-val">{hardwareDetails.sdr.serial}</span>
					</div>
				{/if}
				{#if hardwareDetails?.sdr?.firmwareApi}
					<div class="detail-row">
						<span class="detail-key">FW API</span>
						<span class="detail-val">{hardwareDetails.sdr.firmwareApi}</span>
					</div>
				{/if}
				{#if hardwareDetails?.sdr?.usbSpeed}
					<div class="detail-row">
						<span class="detail-key">USB</span>
						<span class="detail-val">{hardwareDetails.sdr.usbSpeed}</span>
					</div>
				{/if}
				{#if hardwareStatus.hackrf.owner}
					<div class="detail-row">
						<span class="detail-key">Used by</span>
						<span class="detail-val accent">{hardwareStatus.hackrf.owner}</span>
					</div>
				{/if}
				{#if !hardwareDetails?.sdr?.manufacturer && !hardwareStatus.hackrf.isDetected}
					<div class="detail-row">
						<span class="detail-key">Status</span>
						<span class="detail-val dim">Not detected</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ALFA WiFi -->
		<button class="scan-row clickable" onclick={() => onToggleExpand('alfa')}>
			<span
				class="scan-dot"
				class:active={hardwareStatus.alfa.isDetected && hardwareStatus.alfa.owner}
				class:standby={hardwareStatus.alfa.isDetected && !hardwareStatus.alfa.owner}
			></span>
			<span class="scan-name">ALFA WiFi</span>
			{#if !hardwareStatus.alfa.isDetected}
				<span class="scan-status-text">not found</span>
			{:else if hardwareStatus.alfa.owner}
				<span class="scan-owner">{hardwareStatus.alfa.owner}</span>
			{:else}
				<span class="scan-status-text available">available</span>
			{/if}
			<span class="row-chevron" class:expanded={expandedRow === 'alfa'}>&#8250;</span>
		</button>
		{#if expandedRow === 'alfa'}
			<div class="detail-panel">
				{#if hardwareDetails?.wifi?.chipset}
					<div class="detail-row">
						<span class="detail-key">Chipset</span>
						<span class="detail-val">{hardwareDetails.wifi.chipset}</span>
					</div>
				{/if}
				{#if hardwareDetails?.wifi?.mac}
					<div class="detail-row">
						<span class="detail-key">MAC</span>
						<span class="detail-val">{hardwareDetails.wifi.mac}</span>
					</div>
				{/if}
				{#if hardwareDetails?.wifi?.driver}
					<div class="detail-row">
						<span class="detail-key">Driver</span>
						<span class="detail-val">{hardwareDetails.wifi.driver}</span>
					</div>
				{/if}
				{#if hardwareDetails?.wifi?.interface || hardwareDetails?.wifi?.monitorInterface}
					<div class="detail-row">
						<span class="detail-key">Interface</span>
						<span class="detail-val"
							>{hardwareDetails.wifi.monitorInterface ||
								hardwareDetails.wifi.interface}</span
						>
					</div>
				{/if}
				{#if hardwareDetails?.wifi?.mode}
					<div class="detail-row">
						<span class="detail-key">Mode</span>
						<span class="detail-val">{hardwareDetails.wifi.mode}</span>
					</div>
				{/if}
				{#if hardwareDetails?.wifi?.bands && hardwareDetails.wifi.bands.length > 0}
					<div class="detail-row">
						<span class="detail-key">Bands</span>
						<span class="detail-val">{hardwareDetails.wifi.bands.join(', ')}</span>
					</div>
				{/if}
				{#if hardwareStatus.alfa.owner}
					<div class="detail-row">
						<span class="detail-key">Used by</span>
						<span class="detail-val accent">{hardwareStatus.alfa.owner}</span>
					</div>
				{/if}
				{#if !hardwareDetails?.wifi?.chipset && !hardwareStatus.alfa.isDetected}
					<div class="detail-row">
						<span class="detail-key">Status</span>
						<span class="detail-val dim">Not detected</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Bluetooth -->
		<button class="scan-row clickable" onclick={() => onToggleExpand('bluetooth')}>
			<span
				class="scan-dot"
				class:active={hardwareStatus.bluetooth.isDetected && hardwareStatus.bluetooth.owner}
				class:standby={hardwareStatus.bluetooth.isDetected &&
					!hardwareStatus.bluetooth.owner}
			></span>
			<span class="scan-name">Bluetooth</span>
			{#if !hardwareStatus.bluetooth.isDetected}
				<span class="scan-status-text">not found</span>
			{:else if hardwareStatus.bluetooth.owner}
				<span class="scan-owner">{hardwareStatus.bluetooth.owner}</span>
			{:else}
				<span class="scan-status-text available">available</span>
			{/if}
			<span class="row-chevron" class:expanded={expandedRow === 'bluetooth'}>&#8250;</span>
		</button>
		{#if expandedRow === 'bluetooth'}
			<div class="detail-panel">
				<div class="detail-row">
					<span class="detail-key">Status</span>
					<span class="detail-val"
						>{hardwareStatus.bluetooth.isDetected ? 'Detected' : 'Not detected'}</span
					>
				</div>
				{#if hardwareStatus.bluetooth.owner}
					<div class="detail-row">
						<span class="detail-key">Used by</span>
						<span class="detail-val accent">{hardwareStatus.bluetooth.owner}</span>
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="no-data">Scanning hardware...</div>
	{/if}
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

	.scan-dot.standby {
		background: var(--palantir-warning);
		box-shadow: 0 0 4px color-mix(in srgb, var(--palantir-warning) 40%, transparent);
	}

	.scan-name {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
		flex: 1;
	}

	.scan-status-text {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}

	.scan-status-text.available {
		color: var(--palantir-accent);
	}

	.scan-owner {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-success);
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

	.detail-val.accent {
		color: var(--palantir-success);
	}

	.detail-val.dim {
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
