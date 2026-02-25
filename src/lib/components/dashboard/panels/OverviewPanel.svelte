<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';

	import {
		activePanel,
		type ActiveView,
		activeView
	} from '$lib/stores/dashboard/dashboard-store';
	import { gpsStore } from '$lib/stores/tactical-map/gps-store';
	import { kismetStore } from '$lib/stores/tactical-map/kismet-store';
	import type { SystemInfo } from '$lib/types/system';
	import { fetchJSON } from '$lib/utils/fetch-json';

	import HardwareCard from './overview/HardwareCard.svelte';
	import ServicesCard from './overview/ServicesCard.svelte';
	import SystemInfoCard from './overview/SystemInfoCard.svelte';
	import type { HardwareDetails, HardwareStatus } from './overview/types';

	let systemInfo: SystemInfo | null = $state(null);
	let hardwareStatus: HardwareStatus | null = $state(null);
	let hardwareDetails: HardwareDetails | null = $state(null);

	// Log stats fetched from /api/system/logs
	interface LogStats {
		totalEvents: number;
		warnings: number;
		errors: number;
		lastAlert: number | null; // epoch ms
	}
	let logStats: LogStats | null = $state(null);

	// gpsd uptime — sourced from system uptime as a proxy (gpsd runs at boot)
	let gpsdRunning = $derived(
		$gpsStore.status.hasGPSFix || $gpsStore.status.gpsStatus !== 'Requesting GPS...'
	);
	let gpsdUptime = $derived.by(() => {
		const s = systemInfo;
		return s ? s.uptime : null;
	});

	function openTool(view: ActiveView) {
		activeView.set(view);
		activePanel.set(null);
	}

	async function fetchSystem() {
		systemInfo = await fetchJSON<SystemInfo>('/api/system/info');
	}

	async function fetchHardware() {
		hardwareStatus = await fetchJSON<HardwareStatus>('/api/hardware/status');
	}

	async function fetchHardwareDetails() {
		hardwareDetails = await fetchJSON<HardwareDetails>('/api/hardware/details');
	}

	async function fetchLogStats() {
		interface LogResponse {
			total_errors: number;
			sources: { entries: string[] }[];
		}
		const res = await fetchJSON<LogResponse>('/api/system/logs?minutes=1440');
		if (res) {
			logStats = {
				totalEvents: res.sources.reduce((s, src) => s + src.entries.length, 0),
				warnings: 0,
				errors: res.total_errors,
				lastAlert: null
			};
		}
	}

	// Tool status display
	const TOOL_VIEWS: { id: ActiveView; label: string }[] = [
		{ id: 'bettercap', label: 'bettercap' },
		{ id: 'gsm-evil', label: 'gsm-evil' },
		{ id: 'kismet', label: 'kismet' },
		{ id: 'openwebrx', label: 'openwebrx' }
	];

	function toolStatus(id: string): { label: string; uptime: string | null } {
		if (id === 'kismet') {
			const running = $kismetStore.status === 'running';
			return {
				label: running ? 'running' : 'stopped',
				uptime: running ? null : null
			};
		}
		return { label: 'idle', uptime: null };
	}

	function toolActive(id: string): boolean {
		return id === 'kismet' && $kismetStore.status === 'running';
	}

	let lastAlertDisplay = $derived.by(() => {
		if (!logStats?.lastAlert) return null;
		const ago = Math.floor((Date.now() - logStats.lastAlert) / 60000);
		return `${ago}m ago`;
	});

	onMount(() => {
		void fetchSystem();
		void fetchHardware();
		void fetchHardwareDetails();
		void fetchLogStats();
		const refreshInterval = setInterval(() => {
			void fetchSystem();
			void fetchHardware();
		}, 5000);
		const logInterval = setInterval(() => void fetchLogStats(), 30000);
		return () => {
			clearInterval(refreshInterval);
			clearInterval(logInterval);
		};
	});
</script>

<div class="overview-panel">
	<header class="panel-header">
		<span class="panel-title">SYSTEM OVERVIEW</span>
	</header>

	<!-- CPU · Disk · Memory · Power · Network Status -->
	<SystemInfoCard {systemInfo} />

	<!-- Hardware -->
	<HardwareCard {hardwareStatus} {hardwareDetails} />

	<!-- Tools -->
	<section class="tools-section">
		<h3 class="section-label">TOOLS</h3>
		{#each TOOL_VIEWS as tool (tool.id)}
			{@const status = toolStatus(tool.id)}
			{@const active = toolActive(tool.id)}
			<button class="tool-row" onclick={() => openTool(tool.id)}>
				<span class="tool-dot" class:active></span>
				<span class="tool-name">{tool.label}</span>
				<span class="tool-status" class:active>
					{status.label}{status.uptime ? ` ${status.uptime}` : ''}
				</span>
				<span class="tool-chevron">›</span>
			</button>
		{/each}
	</section>

	<!-- Services (gpsd) -->
	<ServicesCard {gpsdUptime} {gpsdRunning} />

	<!-- Logs -->
	<section class="logs-section">
		<div class="logs-header">
			<h3 class="section-label">LOGS</h3>
			<span class="logs-export">↗</span>
		</div>
		<div class="log-row">
			<span class="log-key">Events 24h</span>
			<span class="log-val">{logStats?.totalEvents ?? '—'}</span>
		</div>
		<div class="log-row">
			<span class="log-key">Warnings</span>
			<span class="log-val warn">{logStats?.warnings ?? '—'}</span>
		</div>
		<div class="log-row">
			<span class="log-key">Errors</span>
			<span class="log-val error">{logStats?.errors ?? '—'}</span>
		</div>
		{#if lastAlertDisplay}
			<div class="log-row">
				<span class="log-key">Last alert</span>
				<span class="log-val muted">{lastAlertDisplay}</span>
			</div>
		{/if}
	</section>
</div>

<style>
	.overview-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
	}

	.panel-header {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.panel-title {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 1.5px;
		color: var(--muted-foreground, #888888);
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

	/* ── Tools section ── */
	.tools-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tool-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		background: none;
		border: none;
		padding: 3px 0;
		cursor: pointer;
		text-align: left;
	}

	.tool-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--muted-foreground, #555555);
	}

	.tool-dot.active {
		background: var(--success, #8bbfa0);
	}

	.tool-name {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		flex: 1;
	}

	.tool-status {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.tool-status.active {
		color: var(--success, #8bbfa0);
	}

	.tool-chevron {
		font-size: 14px;
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.tool-row:hover .tool-name,
	.tool-row:hover .tool-chevron {
		color: var(--foreground);
	}

	/* ── Logs section ── */
	.logs-section {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.logs-header {
		display: flex;
		align-items: center;
		margin-bottom: 4px;
	}

	.logs-export {
		margin-left: auto;
		font-size: 11px;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.log-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}

	.log-key {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.log-val {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.log-val.warn {
		color: var(--warning, #d4a054);
	}

	.log-val.error {
		color: var(--destructive, #ff5c33);
	}

	.log-val.muted {
		color: var(--muted-foreground);
	}
</style>
