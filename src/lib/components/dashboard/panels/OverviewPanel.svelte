<!-- @constitutional-exemption Article-IV-4.3 issue:#TBD — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { activePanel, activeView } from '$lib/stores/dashboard/dashboard-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import type { SystemInfo } from '$lib/types/system';

	interface DeviceState {
		device: string;
		available: boolean;
		owner: string | null;
		connectedSince: number | null;
		detected: boolean;
	}

	interface HardwareStatus {
		hackrf: DeviceState;
		alfa: DeviceState;
		bluetooth: DeviceState;
	}

	interface HardwareDetails {
		wifi?: {
			interface?: string;
			monitorInterface?: string;
			mac?: string;
			driver?: string;
			chipset?: string;
			mode?: string;
			channel?: string;
			bands?: string[];
		};
		sdr?: {
			serial?: string;
			product?: string;
			manufacturer?: string;
			firmwareApi?: string;
			usbSpeed?: string;
			maxPower?: string;
			configuration?: string;
		};
		gps?: {
			device?: string;
			protocol?: string;
			baudRate?: number;
			usbAdapter?: string;
			gpsdVersion?: string;
		};
	}

	let systemInfo: SystemInfo | null = $state(null);
	let hardwareStatus: HardwareStatus | null = $state(null);
	let hardwareDetails: HardwareDetails | null = $state(null);
	let expandedRow: string | null = $state(null);

	function toggleExpand(id: string) {
		expandedRow = expandedRow === id ? null : id;
	}

	function openTool(view: string) {
		activeView.set(view);
		activePanel.set(null);
	}

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
		} catch (_error: unknown) {
			/* silent */
		}
	}

	async function fetchHardware() {
		try {
			const res = await fetch('/api/hardware/status');
			if (res.ok) hardwareStatus = await res.json();
		} catch (_error: unknown) {
			/* silent */
		}
	}

	async function fetchHardwareDetails() {
		try {
			const res = await fetch('/api/hardware/details');
			if (res.ok) hardwareDetails = await res.json();
		} catch (_error: unknown) {
			/* silent */
		}
	}

	onMount(() => {
		void fetchSystem();
		void fetchHardware();
		void fetchHardwareDetails();
		// Refresh system info every 5 seconds for responsive updates
		const refreshInterval = setInterval(() => {
			void fetchSystem();
			void fetchHardware();
		}, 5000);
		return () => {
			clearInterval(refreshInterval);
		};
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

	<!-- Services -->
	<section class="panel-section">
		<div class="section-label">SERVICES</div>
		<button class="scan-row clickable" onclick={() => openTool('kismet')}>
			<span class="scan-dot" class:active={$kismetStore.status === 'running'}></span>
			<span class="scan-name">Kismet WiFi</span>
			{#if $kismetStore.status === 'running'}
				<span class="scan-count">{$kismetStore.deviceCount}</span>
			{:else}
				<span class="scan-status-text">stopped</span>
			{/if}
			<span class="row-chevron">&#8250;</span>
		</button>
		<button class="scan-row clickable" onclick={() => toggleExpand('gps')}>
			<span class="scan-dot" class:active={$gpsStore.status.hasGPSFix}></span>
			<span class="scan-name">GPS</span>
			{#if $gpsStore.status.hasGPSFix}
				<span class="scan-count">{$gpsStore.status.satellites} sats</span>
			{:else}
				<span class="scan-status-text">no fix</span>
			{/if}
			<span class="row-chevron" class:expanded={expandedRow === 'gps'}>&#8250;</span>
		</button>
		{#if expandedRow === 'gps' && hardwareDetails?.gps}
			<div class="detail-panel">
				{#if hardwareDetails.gps.device}
					<div class="detail-row">
						<span class="detail-key">Device</span>
						<span class="detail-val">{hardwareDetails.gps.device}</span>
					</div>
				{/if}
				{#if hardwareDetails.gps.protocol}
					<div class="detail-row">
						<span class="detail-key">Protocol</span>
						<span class="detail-val">{hardwareDetails.gps.protocol}</span>
					</div>
				{/if}
				{#if hardwareDetails.gps.baudRate}
					<div class="detail-row">
						<span class="detail-key">Baud Rate</span>
						<span class="detail-val">{hardwareDetails.gps.baudRate}</span>
					</div>
				{/if}
				{#if hardwareDetails.gps.usbAdapter}
					<div class="detail-row">
						<span class="detail-key">Adapter</span>
						<span class="detail-val">{hardwareDetails.gps.usbAdapter}</span>
					</div>
				{/if}
				{#if hardwareDetails.gps.gpsdVersion}
					<div class="detail-row">
						<span class="detail-key">GPSD</span>
						<span class="detail-val">v{hardwareDetails.gps.gpsdVersion}</span>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<!-- Hardware -->
	<section class="panel-section">
		<div class="section-label">HARDWARE</div>
		{#if hardwareStatus}
			<!-- HackRF -->
			<button class="scan-row clickable" onclick={() => toggleExpand('hackrf')}>
				<span
					class="scan-dot"
					class:active={hardwareStatus.hackrf.detected && hardwareStatus.hackrf.owner}
					class:standby={hardwareStatus.hackrf.detected && !hardwareStatus.hackrf.owner}
				></span>
				<span class="scan-name">HackRF</span>
				{#if !hardwareStatus.hackrf.detected}
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
					{#if !hardwareDetails?.sdr?.manufacturer && !hardwareStatus.hackrf.detected}
						<div class="detail-row">
							<span class="detail-key">Status</span>
							<span class="detail-val dim">Not detected</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- ALFA WiFi -->
			<button class="scan-row clickable" onclick={() => toggleExpand('alfa')}>
				<span
					class="scan-dot"
					class:active={hardwareStatus.alfa.detected && hardwareStatus.alfa.owner}
					class:standby={hardwareStatus.alfa.detected && !hardwareStatus.alfa.owner}
				></span>
				<span class="scan-name">ALFA WiFi</span>
				{#if !hardwareStatus.alfa.detected}
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
					{#if !hardwareDetails?.wifi?.chipset && !hardwareStatus.alfa.detected}
						<div class="detail-row">
							<span class="detail-key">Status</span>
							<span class="detail-val dim">Not detected</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Bluetooth -->
			<button class="scan-row clickable" onclick={() => toggleExpand('bluetooth')}>
				<span
					class="scan-dot"
					class:active={hardwareStatus.bluetooth.detected &&
						hardwareStatus.bluetooth.owner}
					class:standby={hardwareStatus.bluetooth.detected &&
						!hardwareStatus.bluetooth.owner}
				></span>
				<span class="scan-name">Bluetooth</span>
				{#if !hardwareStatus.bluetooth.detected}
					<span class="scan-status-text">not found</span>
				{:else if hardwareStatus.bluetooth.owner}
					<span class="scan-owner">{hardwareStatus.bluetooth.owner}</span>
				{:else}
					<span class="scan-status-text available">available</span>
				{/if}
				<span class="row-chevron" class:expanded={expandedRow === 'bluetooth'}>&#8250;</span
				>
			</button>
			{#if expandedRow === 'bluetooth'}
				<div class="detail-panel">
					<div class="detail-row">
						<span class="detail-key">Status</span>
						<span class="detail-val"
							>{hardwareStatus.bluetooth.detected ? 'Detected' : 'Not detected'}</span
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

	/* Scan / hardware rows */
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
		box-shadow: 0 0 4px rgba(74, 222, 128, 0.5);
	}

	.scan-dot.standby {
		background: var(--palantir-warning);
		box-shadow: 0 0 4px rgba(251, 191, 36, 0.4);
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

	/* Expandable detail panels */
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
