<script lang="ts">
	import type { SystemInfo } from '$lib/types/system';

	import { formatBytes, formatUptime } from './types';

	interface Props {
		systemInfo: SystemInfo | null;
	}

	let { systemInfo }: Props = $props();
</script>

<section class="panel-section">
	<div class="section-label">SYSTEM</div>
	{#if systemInfo}
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">HOST</span>
				<span class="info-value">{systemInfo.hostname}</span>
			</div>
			<div class="info-item">
				<span class="info-label">IP</span>
				<span class="info-value mono">{systemInfo.ip}</span>
			</div>
			{#if systemInfo.tailscaleIp}
				<div class="info-item">
					<span class="info-label">TAILSCALE</span>
					<span class="info-value mono">{systemInfo.tailscaleIp}</span>
				</div>
			{/if}
			<div class="info-item">
				<span class="info-label">UPTIME</span>
				<span class="info-value">{formatUptime(systemInfo.uptime)}</span>
			</div>
			{#if systemInfo.temperature != null}
				<div class="info-item">
					<span class="info-label">TEMP</span>
					<span class="info-value">{systemInfo.temperature.toFixed(1)}C</span>
				</div>
			{/if}
		</div>

		<!-- CPU -->
		<div class="meter-row">
			<span class="meter-label">CPU ({systemInfo.cpu.cores} cores)</span>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: {systemInfo.cpu.usage}%; background: {systemInfo.cpu.usage > 80
						? 'var(--palantir-error)'
						: systemInfo.cpu.usage > 50
							? 'var(--palantir-warning)'
							: 'var(--palantir-accent)'}"
				></div>
			</div>
			<span class="meter-value">{systemInfo.cpu.usage.toFixed(0)}%</span>
		</div>

		<!-- Memory -->
		<div class="meter-row">
			<span class="meter-label">RAM</span>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: {systemInfo.memory.percentage}%; background: {systemInfo.memory
						.percentage > 85
						? 'var(--palantir-error)'
						: 'var(--palantir-accent)'}"
				></div>
			</div>
			<span class="meter-value"
				>{systemInfo.memory.percentage.toFixed(0)}% ({formatBytes(
					systemInfo.memory.used
				)})</span
			>
		</div>

		<!-- Storage -->
		<div class="meter-row">
			<span class="meter-label">DISK</span>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: {systemInfo.storage.percentage}%; background: {systemInfo.storage
						.percentage > 90
						? 'var(--palantir-error)'
						: 'var(--palantir-accent)'}"
				></div>
			</div>
			<span class="meter-value">{systemInfo.storage.percentage}%</span>
		</div>
	{:else}
		<div class="no-data">Loading system info...</div>
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

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		letter-spacing: var(--letter-spacing-wider);
	}

	.info-value {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.info-value.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.meter-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.meter-label {
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
		min-width: 42px;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meter-bar {
		flex: 1;
		height: 4px;
		background: var(--palantir-bg-elevated);
		border-radius: 2px;
		overflow: hidden;
	}

	.meter-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.meter-value {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-secondary);
		min-width: 48px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
