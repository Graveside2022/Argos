<script lang="ts">
	import type { SystemInfo } from '$lib/types/system';

	import { formatBytes, formatUptime } from './types';

	interface Props {
		systemInfo: SystemInfo | null;
	}

	let { systemInfo }: Props = $props();

	function meterColor(value: number, warn: number, crit: number): string {
		if (value > crit) return 'var(--status-error, #C45B4A)';
		if (value > warn) return 'var(--status-warning, #D4A054)';
		return 'var(--primary)';
	}
</script>

{#if systemInfo}
	<!-- CPU Section -->
	<section class="sidebar-section">
		<h3 class="section-header">CPU</h3>
		<div class="hero-metric">{systemInfo.cpu.usage.toFixed(0)}%</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.cpu.usage}%; background: {meterColor(
					systemInfo.cpu.usage,
					50,
					80
				)}"
			></div>
		</div>
		<div class="section-detail">
			{systemInfo.cpu.cores} cores &middot; {systemInfo.cpu.model}
		</div>
	</section>

	<!-- Disk Section -->
	<section class="sidebar-section">
		<h3 class="section-header">DISK</h3>
		<div class="hero-metric">{formatBytes(systemInfo.storage.used)}</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.storage.percentage}%; background: {meterColor(
					systemInfo.storage.percentage,
					75,
					90
				)}"
			></div>
		</div>
		<div class="section-detail">
			{formatBytes(systemInfo.storage.total)} total &middot; {systemInfo.storage.percentage}%
			used
		</div>
	</section>

	<!-- Memory Section -->
	<section class="sidebar-section">
		<h3 class="section-header">MEMORY</h3>
		<div class="hero-metric">{formatBytes(systemInfo.memory.used)}</div>
		<div class="meter-bar">
			<div
				class="meter-fill"
				style="width: {systemInfo.memory.percentage}%; background: {meterColor(
					systemInfo.memory.percentage,
					70,
					85
				)}"
			></div>
		</div>
		<div class="section-detail">
			{formatBytes(systemInfo.memory.total)} total &middot; {systemInfo.memory.percentage.toFixed(
				0
			)}% used
		</div>
	</section>

	<!-- Power Section -->
	<section class="sidebar-section">
		<h3 class="section-header">POWER</h3>
		{#if systemInfo.battery}
			<div class="hero-metric">{systemInfo.battery.level}%</div>
			<div class="meter-bar">
				<div
					class="meter-fill"
					style="width: {systemInfo.battery.level}%; background: {meterColor(
						100 - systemInfo.battery.level,
						60,
						80
					)}"
				></div>
			</div>
			<div class="section-detail">
				{systemInfo.battery.charging ? 'Charging' : 'On battery'}
			</div>
		{:else}
			<div class="section-detail">
				AC Power &middot; {systemInfo.temperature != null
					? `${systemInfo.temperature.toFixed(1)}°C`
					: '—'}
			</div>
		{/if}
	</section>

	<!-- Network Status Section -->
	<section class="sidebar-section">
		<h3 class="section-header">NETWORK STATUS</h3>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">IP</span>
				<span class="info-value">{systemInfo.ip}</span>
			</div>
			{#if systemInfo.tailscaleIp}
				<div class="info-item">
					<span class="info-label">TAILSCALE</span>
					<span class="info-value">{systemInfo.tailscaleIp}</span>
				</div>
			{/if}
			<div class="info-item">
				<span class="info-label">HOST</span>
				<span class="info-value">{systemInfo.hostname}</span>
			</div>
			<div class="info-item">
				<span class="info-label">UPTIME</span>
				<span class="info-value">{formatUptime(systemInfo.uptime)}</span>
			</div>
		</div>
	</section>
{:else}
	<section class="sidebar-section">
		<h3 class="section-header">SYSTEM</h3>
		<div class="no-data">Loading system info...</div>
	</section>
{/if}

<style>
	.sidebar-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-header {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.hero-metric {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 24px;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.meter-bar {
		width: 100%;
		height: 4px;
		background: var(--surface-elevated, #151515);
		border-radius: 2px;
		overflow: hidden;
	}

	.meter-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.section-detail {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		letter-spacing: 1px;
		color: var(--foreground-secondary, #888888);
	}

	.info-value {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 11px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.no-data {
		font-size: 12px;
		color: var(--muted-foreground);
		font-style: italic;
	}
</style>
