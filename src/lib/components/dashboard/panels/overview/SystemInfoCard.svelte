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

	let memFreeGB = $derived(
		systemInfo?.memory.free != null ? formatBytes(systemInfo.memory.free) : null
	);
</script>

{#if systemInfo}
	<!-- CPU -->
	<section class="metric-section">
		<h3 class="section-label">CPU</h3>
		<div class="metric-row">
			<span class="metric-primary">{systemInfo.cpu.usage.toFixed(0)}%</span>
			{#if systemInfo.temperature != null}
				<span class="metric-secondary">{systemInfo.temperature.toFixed(0)}°C</span>
			{/if}
		</div>
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
	</section>

	<!-- Disk -->
	<section class="metric-section">
		<h3 class="section-label">DISK</h3>
		<div class="metric-row">
			<span class="metric-primary">{formatBytes(systemInfo.storage.used)}</span>
			<span class="metric-secondary">/ {formatBytes(systemInfo.storage.total)}</span>
		</div>
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
	</section>

	<!-- Memory -->
	<section class="metric-section">
		<h3 class="section-label">MEMORY</h3>
		<div class="metric-row">
			<span class="metric-primary">{formatBytes(systemInfo.memory.used)}</span>
			{#if memFreeGB}
				<span class="metric-secondary">{memFreeGB} free</span>
			{/if}
		</div>
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
	</section>

	<!-- Power -->
	<section class="metric-section">
		<h3 class="section-label">POWER</h3>
		{#if systemInfo.battery}
			<div class="metric-row">
				<span class="metric-primary">{systemInfo.battery.level}%</span>
				<span class="metric-secondary">
					{systemInfo.battery.charging
						? 'charging'
						: systemInfo.battery.level > 20
							? `${Math.floor((systemInfo.battery.level / 100) * 5)}h remaining`
							: 'low battery'}
				</span>
			</div>
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
		{:else}
			<div class="metric-row">
				<span class="metric-primary ac">AC</span>
				{#if systemInfo.temperature != null}
					<span class="metric-secondary">{systemInfo.temperature.toFixed(1)}°C</span>
				{/if}
			</div>
			<div class="meter-bar">
				<div class="meter-fill" style="width: 100%; background: var(--primary)"></div>
			</div>
		{/if}
	</section>

	<!-- Network Status -->
	<section class="net-section">
		<div class="net-header">
			<h3 class="section-label">NETWORK STATUS</h3>
			<span class="net-status-dot"></span>
			<span class="net-status-text">connected</span>
		</div>
		<div class="net-row">
			<span class="net-key">Host</span>
			<span class="net-val">{systemInfo.ip}</span>
		</div>
		{#if systemInfo.tailscaleIp}
			<div class="net-row">
				<span class="net-key net-key-muted">VPN</span>
				<span class="net-val">{systemInfo.tailscaleIp}</span>
			</div>
		{/if}
		<div class="net-row">
			<span class="net-key net-key-muted">Host</span>
			<span class="net-val">{systemInfo.hostname}</span>
			<span class="net-uptime">{formatUptime(systemInfo.uptime)}</span>
		</div>
		<button class="speed-test-btn">
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
				<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
			</svg>
			Speed Test
		</button>
	</section>
{:else}
	<section class="metric-section">
		<h3 class="section-label">SYSTEM</h3>
		<span class="loading">Loading...</span>
	</section>
{/if}

<style>
	/* ── Metric sections (CPU / Disk / Memory / Power) ── */
	.metric-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--muted-foreground, #888888);
		margin: 0;
	}

	.metric-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.metric-primary {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 24px;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.metric-primary.ac {
		font-size: 18px;
	}

	.metric-secondary {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 12px;
		color: var(--muted-foreground, #888888);
		font-variant-numeric: tabular-nums;
	}

	.meter-bar {
		width: 100%;
		height: 3px;
		background: var(--surface-elevated, #151515);
		border-radius: 2px;
		overflow: hidden;
	}

	.meter-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	/* ── Network Status section ── */
	.net-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.net-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.net-status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--success, #8bbfa0);
		margin-left: auto;
		flex-shrink: 0;
	}

	.net-status-text {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--success, #8bbfa0);
	}

	.net-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.net-key {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		flex-shrink: 0;
	}

	.net-key-muted {
		color: var(--muted-foreground, #888888);
	}

	.net-val {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.net-uptime {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
		margin-left: auto;
	}

	.speed-test-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		margin-top: 4px;
		padding: 6px;
		background: var(--surface-elevated, #151515);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 4px;
		color: var(--muted-foreground);
		font-family: var(--font-mono);
		font-size: 11px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.speed-test-btn:hover {
		background: var(--surface-hover, #2a2a2a);
		color: var(--foreground);
	}

	.loading {
		font-size: 11px;
		color: var(--muted-foreground);
		font-style: italic;
	}
</style>
