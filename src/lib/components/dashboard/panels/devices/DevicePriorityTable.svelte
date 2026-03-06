<script lang="ts">
	import type { KismetDevice } from '$lib/kismet/types';
	import type { ReconAlert, ReconTarget } from '$lib/stores/dashboard/recon-store';
	import { getSignalHex } from '$lib/utils/signal-utils';

	import { formatDataSize, formatEncryption, getRSSI } from './device-formatters';

	interface Props {
		devices: KismetDevice[];
		reconTargets: ReconTarget[];
		reconAlerts: ReconAlert[];
		reconStatus: 'idle' | 'loading' | 'ready' | 'error';
		onRowClick: (device: KismetDevice) => void;
		onRefresh: () => void;
	}

	let { devices, reconTargets, reconAlerts, reconStatus, onRowClick, onRefresh }: Props =
		$props();

	/** Merge recon enrichment into Kismet devices by MAC lookup */
	let enrichedDevices = $derived.by(() => {
		if (reconTargets.length === 0) return [];
		const reconMap = new Map(reconTargets.map((t) => [t.mac.toUpperCase(), t]));

		return devices
			.map((d) => {
				const recon = reconMap.get(d.mac.toUpperCase());
				return recon ? { device: d, recon } : null;
			})
			.filter(
				(entry): entry is { device: KismetDevice; recon: ReconTarget } =>
					entry !== null && getPriorityReasons(entry.recon).length > 0
			)
			.sort((a, b) => {
				const ra = getPriorityReasons(a.recon).length;
				const rb = getPriorityReasons(b.recon).length;
				if (rb !== ra) return rb - ra;
				return (b.recon.signal_dbm || -999) - (a.recon.signal_dbm || -999);
			});
	});

	const FALLBACK_CHECKS: Array<(d: KismetDevice) => boolean> = [
		(d) => formatEncryption(d) === 'Open',
		(d) => formatEncryption(d).includes('WEP'),
		(d) => formatEncryption(d).includes('TKIP'),
		(d) => !!(d as Record<string, unknown>).wpsEnabled,
		(d) => !!(d as Record<string, unknown>).wps_enabled,
		(d) => !!(d as Record<string, unknown>).cloaked,
		(d) => !d.ssid,
		(d) => d.ssid === 'Hidden',
		(d) => (d.clients?.length ?? 0) > 3
	];

	/** Fallback: use basic Kismet data when recon hasn't loaded */
	let fallbackDevices = $derived(
		devices
			.filter((d) => FALLBACK_CHECKS.some((check) => check(d)))
			.sort((a, b) => (getRSSI(b) || -999) - (getRSSI(a) || -999))
	);

	interface PriorityRule {
		check: (t: ReconTarget) => boolean;
		label: string | ((t: ReconTarget) => string);
	}

	const PRIORITY_RULES: PriorityRule[] = [
		{ check: (t) => !t.encryption || t.encryption === 'Open', label: 'OPEN' },
		{ check: (t) => !!t.encryption?.includes('WEP'), label: 'WEP' },
		{ check: (t) => !!t.encryption?.includes('TKIP'), label: 'TKIP' },
		{ check: (t) => !!t.wps_enabled, label: 'WPS' },
		{ check: (t) => !!t.cloaked, label: 'HIDDEN' },
		{ check: (t) => !t.ssid || t.ssid === 'Hidden', label: 'NO SSID' },
		{ check: (t) => (t.num_clients ?? 0) > 3, label: (t) => `${t.num_clients} clients` },
		{ check: (t) => (t.retry_bytes ?? 0) > 10000, label: 'HIGH RETRY' },
		{ check: (t) => (t.packets_error ?? 0) > 100, label: 'ERRORS' }
	];

	function getPriorityReasons(target: ReconTarget): string[] {
		return PRIORITY_RULES.filter((rule) => rule.check(target)).map((rule) =>
			typeof rule.label === 'function' ? rule.label(target) : rule.label
		);
	}

	let hasReconData = $derived(reconStatus === 'ready' && enrichedDevices.length > 0);
	let isLoading = $derived(reconStatus === 'loading');
</script>

<div class="priority-header">
	<span class="priority-label">
		{#if isLoading}
			SCANNING...
		{:else if hasReconData}
			{enrichedDevices.length} PRIORITY TARGETS (enriched)
		{:else}
			{fallbackDevices.length} PRIORITY TARGETS
		{/if}
	</span>
	<button class="refresh-btn" onclick={onRefresh} disabled={isLoading}>
		{isLoading ? '...' : 'SCAN'}
	</button>
</div>

{#if hasReconData}
	<!-- Enriched view with recon data -->
	<div class="table-scroll">
		<table class="data-table data-table-compact">
			<thead>
				<tr>
					<th class="col-mac">SSID / MAC</th>
					<th class="col-rssi">RSSI</th>
					<th class="col-enc">ENCRYPTION</th>
					<th class="col-reason">REASONS</th>
					<th class="col-ch">CH</th>
					<th class="col-clients">CLIENTS</th>
					<th class="col-data">DATA</th>
					<th class="col-extra">ENRICHED</th>
				</tr>
			</thead>
			<tbody>
				{#each enrichedDevices as { device, recon } (device.mac)}
					{@const reasons = getPriorityReasons(recon)}
					<tr onclick={() => onRowClick(device)}>
						<td class="col-mac">
							<div class="cell-stack">
								<span class="cell-primary">{recon.ssid || 'Hidden'}</span>
								<span class="cell-secondary">{device.mac}</span>
							</div>
						</td>
						<td class="col-rssi">
							<div class="rssi-cell">
								<span
									class="signal-indicator"
									style="background: {getSignalHex(recon.signal_dbm)}"
								></span>
								<span class="rssi-value"
									>{recon.signal_dbm !== 0 ? recon.signal_dbm : '-'}</span
								>
							</div>
						</td>
						<td class="col-enc">
							<span class="enc-badge">{recon.encryption}</span>
						</td>
						<td class="col-reason">
							<div class="reason-tags">
								{#each reasons as reason}
									<span
										class="reason-tag"
										class:critical={reason === 'OPEN' || reason === 'WEP'}
										class:warning={reason === 'TKIP' ||
											reason === 'WPS' ||
											reason === 'HIDDEN'}
										class:info={reason === 'HIGH RETRY' || reason === 'ERRORS'}
									>
										{reason}
									</span>
								{/each}
							</div>
						</td>
						<td class="col-ch">
							<span class="mono-value">{recon.channel || '-'}</span>
						</td>
						<td class="col-clients">
							<span class="mono-value">{recon.num_clients ?? '-'}</span>
						</td>
						<td class="col-data">
							<span class="mono-value">{formatDataSize(recon.bytes_data || 0)}</span>
						</td>
						<td class="col-extra">
							<div class="enrichment-tags">
								{#if recon.wps_enabled}
									<span class="enrich-tag critical"
										>WPS v{recon.wps_version ?? '?'}</span
									>
								{/if}
								{#if recon.cloaked}
									<span class="enrich-tag warning">Cloaked</span>
								{/if}
								{#if recon.ht_mode}
									<span class="enrich-tag dim"
										>{recon.ht_mode} {recon.max_rate_mbps ?? ''}Mbps</span
									>
								{/if}
								{#if recon.probed_ssids?.length}
									<span class="enrich-tag" title={recon.probed_ssids.join(', ')}
										>Probed {recon.probed_ssids.length} SSIDs</span
									>
								{/if}
								{#if recon.freq_map_khz && Object.keys(recon.freq_map_khz).length > 1}
									<span class="enrich-tag"
										>{Object.keys(recon.freq_map_khz).length} freqs</span
									>
								{/if}
								{#if recon.beacon_fingerprint}
									<span
										class="enrich-tag"
										title="Beacon FP: {recon.beacon_fingerprint}"
										>BFP:{recon.beacon_fingerprint.slice(0, 6)}</span
									>
								{/if}
								{#if recon.gps_bounds}
									<span class="enrich-tag">GPS tracked</span>
								{/if}
								{#if (recon.retry_bytes ?? 0) > 0}
									<span class="enrich-tag warning"
										>Retry {formatDataSize(recon.retry_bytes ?? 0)}</span
									>
								{/if}
								{#if recon.observation_secs}
									<span class="enrich-tag dim"
										>{Math.round(recon.observation_secs / 60)}m observed</span
									>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if reconAlerts.length > 0}
		<div class="alerts-section">
			<div class="alerts-header">KISMET ALERTS ({reconAlerts.length})</div>
			<div class="alerts-list">
				{#each reconAlerts.slice(0, 10) as alert}
					<div class="alert-row" class:alert-high={alert.severity >= 3}>
						<span class="alert-type">{alert.type}</span>
						<span class="alert-text">{alert.text}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else}
	<!-- Fallback: basic Kismet REST data -->
	<div class="table-scroll">
		<table class="data-table data-table-compact">
			<thead>
				<tr>
					<th class="col-mac">SSID / MAC</th>
					<th class="col-rssi">RSSI</th>
					<th class="col-type">TYPE</th>
					<th class="col-enc">ENCRYPTION</th>
					<th class="col-reason">REASONS</th>
					<th class="col-ch">CH</th>
					<th class="col-clients">CLIENTS</th>
					<th class="col-data">DATA</th>
				</tr>
			</thead>
			<tbody>
				{#each fallbackDevices as device (device.mac)}
					{@const rssi = getRSSI(device)}
					{@const enc = formatEncryption(device)}
					<tr onclick={() => onRowClick(device)}>
						<td class="col-mac">
							<div class="cell-stack">
								<span class="cell-primary">{device.ssid || 'Hidden'}</span>
								<span class="cell-secondary">{device.mac}</span>
							</div>
						</td>
						<td class="col-rssi">
							<div class="rssi-cell">
								<span
									class="signal-indicator"
									style="background: {getSignalHex(rssi)}"
								></span>
								<span class="rssi-value">{rssi !== 0 ? rssi : '-'}</span>
							</div>
						</td>
						<td class="col-type">
							<span class="type-badge">{device.type || '-'}</span>
						</td>
						<td class="col-enc">
							<span class="enc-badge">{enc}</span>
						</td>
						<td class="col-reason">
							<div class="reason-tags">
								{#if enc === 'Open'}
									<span class="reason-tag critical">OPEN</span>
								{/if}
								{#if enc.includes('WEP')}
									<span class="reason-tag critical">WEP</span>
								{/if}
								{#if enc.includes('TKIP')}
									<span class="reason-tag warning">TKIP</span>
								{/if}
								{#if !device.ssid || device.ssid === 'Hidden'}
									<span class="reason-tag warning">NO SSID</span>
								{/if}
							</div>
						</td>
						<td class="col-ch">
							<span class="mono-value">{device.channel || '-'}</span>
						</td>
						<td class="col-clients">
							<span class="mono-value">{device.clients?.length || '-'}</span>
						</td>
						<td class="col-data">
							<span class="mono-value"
								>{formatDataSize(device.datasize || device.dataSize || 0)}</span
							>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="8" class="empty-row"> No priority targets detected </td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	@import './device-table-cells.css';

	.priority-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px var(--space-3);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.priority-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		color: var(--warning, #d4a054);
		text-transform: uppercase;
	}

	.refresh-btn {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		padding: 2px 8px;
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		color: var(--primary);
		border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
		border-radius: 3px;
		cursor: pointer;
	}

	.refresh-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--primary) 25%, transparent);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.table-scroll {
		flex: 1;
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	th {
		background: var(--surface-header, #181818);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: var(--letter-spacing-wider);
		color: var(--foreground-secondary, #888888);
		text-align: left;
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	td {
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
	}

	tbody tr {
		cursor: pointer;
	}

	tbody tr:hover {
		background: var(--surface-hover, #1e1e1e);
	}

	.reason-tags,
	.enrichment-tags {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
	}

	.reason-tag,
	.enrich-tag {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.5px;
		padding: 1px 5px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--foreground-secondary) 15%, transparent);
		color: var(--foreground-secondary);
	}

	.reason-tag.critical,
	.enrich-tag.critical {
		background: color-mix(in srgb, var(--destructive, #ff5c33) 20%, transparent);
		color: var(--destructive, #ff5c33);
	}

	.reason-tag.warning {
		background: color-mix(in srgb, var(--warning, #d4a054) 20%, transparent);
		color: var(--warning, #d4a054);
	}

	.reason-tag.info {
		background: color-mix(in srgb, var(--interactive, #4a8af4) 20%, transparent);
		color: var(--interactive, #4a8af4);
	}

	.enrich-tag {
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		color: var(--primary);
		cursor: help;
	}

	.empty-row {
		text-align: center;
		color: var(--foreground-secondary);
		font-style: italic;
		padding: var(--space-6) var(--space-3) !important;
	}

	/* ── Alerts section ──────────────────────────────────── */

	.alerts-section {
		border-top: 1px solid var(--border);
		flex-shrink: 0;
		max-height: 120px;
		overflow: auto;
	}

	.alerts-header {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1px;
		color: var(--warning, #d4a054);
		padding: 4px var(--space-3);
		background: var(--surface-header, #181818);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
	}

	.alerts-list {
		padding: 0;
	}

	.alert-row {
		display: flex;
		gap: var(--space-2);
		padding: 2px var(--space-3);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary);
	}

	.alert-row.alert-high {
		color: var(--destructive, #ff5c33);
	}

	.alert-type {
		font-weight: 600;
		min-width: 120px;
		flex-shrink: 0;
	}

	.alert-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
