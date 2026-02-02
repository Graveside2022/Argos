<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
	import { kismetStore } from '$lib/stores/tactical-map/kismetStore';

	interface SystemInfo {
		hostname: string;
		ip: string;
		wifiInterfaces: Array<{ name: string; ip: string; mac: string }>;
		cpu: { usage: number; model: string; cores: number };
		memory: { total: number; used: number; free: number; percentage: number };
		storage: { total: number; used: number; free: number; percentage: number };
		temperature: number | null;
		uptime: number;
	}

	let systemInfo: SystemInfo | null = null;
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatUptime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 24) {
			const d = Math.floor(h / 24);
			return `${d}d ${h % 24}h`;
		}
		return `${h}h ${m}m`;
	}

	async function fetchSystem() {
		try {
			const res = await fetch('/api/system/info');
			if (res.ok) systemInfo = await res.json();
		} catch {
			/* silent */
		}
	}

	onMount(() => {
		void fetchSystem();
		refreshInterval = setInterval(() => void fetchSystem(), 15000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});
</script>

<div class="overview-panel">
	<header class="panel-header">
		<span class="panel-title">OVERVIEW</span>
	</header>

	<!-- System Info -->
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
						style="width: {systemInfo.cpu.usage}%; background: {systemInfo.cpu.usage >
						80
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
						style="width: {systemInfo.memory.percentage}%; background: {systemInfo
							.memory.percentage > 85
							? 'var(--palantir-error)'
							: 'var(--palantir-accent)'}"
					></div>
				</div>
				<span class="meter-value">{formatBytes(systemInfo.memory.used)}</span>
			</div>

			<!-- Storage -->
			<div class="meter-row">
				<span class="meter-label">DISK</span>
				<div class="meter-bar">
					<div
						class="meter-fill"
						style="width: {systemInfo.storage.percentage}%; background: {systemInfo
							.storage.percentage > 90
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

	<!-- GPS Card -->
	<section class="panel-section">
		<div class="section-label">GPS POSITION</div>
		{#if $gpsStore.status.hasGPSFix}
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">LAT</span>
					<span class="info-value mono">{$gpsStore.status.formattedCoords.lat}</span>
				</div>
				<div class="info-item">
					<span class="info-label">LON</span>
					<span class="info-value mono">{$gpsStore.status.formattedCoords.lon}</span>
				</div>
				<div class="info-item">
					<span class="info-label">MGRS</span>
					<span class="info-value mono">{$gpsStore.status.mgrsCoord}</span>
				</div>
				<div class="info-item">
					<span class="info-label">FIX</span>
					<span class="info-value">{$gpsStore.status.fixType} Fix</span>
				</div>
				<div class="info-item">
					<span class="info-label">SATS</span>
					<span class="info-value">{$gpsStore.status.satellites}</span>
				</div>
				<div class="info-item">
					<span class="info-label">ACC</span>
					<span class="info-value">{$gpsStore.status.accuracy.toFixed(1)}m</span>
				</div>
			</div>
		{:else}
			<div class="no-data">{$gpsStore.status.gpsStatus}</div>
		{/if}
	</section>

	<!-- Active Scans -->
	<section class="panel-section">
		<div class="section-label">ACTIVE SCANS</div>
		{#if $kismetStore.status === 'running'}
			<div class="scan-row">
				<span class="scan-dot active"></span>
				<span class="scan-name">Kismet WiFi</span>
				<span class="scan-count">{$kismetStore.deviceCount}</span>
			</div>
		{:else}
			<div class="no-data">No scans running</div>
		{/if}
	</section>

	<!-- WiFi Interfaces -->
	{#if systemInfo && systemInfo.wifiInterfaces.length > 0}
		<section class="panel-section">
			<div class="section-label">WIFI INTERFACES</div>
			{#each systemInfo.wifiInterfaces as iface (iface.name)}
				<div class="iface-row">
					<span class="iface-name">{iface.name}</span>
					<span class="iface-mac mono">{iface.mac}</span>
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.overview-panel {
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

	.info-value.mono,
	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	/* Meter bars */
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

	/* Interface rows */
	.iface-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-sm);
	}

	.iface-name {
		font-size: var(--text-sm);
		color: var(--palantir-text-primary);
	}

	.iface-mac {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-tertiary);
	}

	.scan-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-md);
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
		box-shadow: 0 0 4px rgba(74, 222, 128, 0.5);
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

	.no-data {
		font-size: var(--text-sm);
		color: var(--palantir-text-tertiary);
		font-style: italic;
	}
</style>
