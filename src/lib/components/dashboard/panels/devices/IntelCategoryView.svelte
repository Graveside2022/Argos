<script lang="ts">
	import type { ReconAlert, ReconTarget } from '$lib/stores/dashboard/recon-store';
	import { getSignalHex } from '$lib/utils/signal-utils';

	import { formatDataSize } from './device-formatters';

	type SortCol =
		| 'ssid'
		| 'rssi'
		| 'encryption'
		| 'channel'
		| 'clients'
		| 'data'
		| 'vendor'
		| 'last_seen';

	interface Props {
		title: string;
		description: string;
		targets: ReconTarget[];
		alerts?: ReconAlert[];
		reconStatus: 'idle' | 'loading' | 'ready' | 'error';
		onRefresh: () => void;
		/** Extra columns to show beyond the base set */
		extraColumns?: Array<{
			id: string;
			label: string;
			render: (t: ReconTarget) => string;
		}>;
	}

	let {
		title,
		description,
		targets,
		alerts = [],
		reconStatus,
		onRefresh,
		extraColumns = []
	}: Props = $props();

	let sortCol: SortCol = $state('rssi');
	let sortDir: 'asc' | 'desc' = $state('desc');

	const ASC_DEFAULT_COLS = new Set<string>(['ssid', 'vendor', 'encryption']);

	function toggleDir(): 'asc' | 'desc' {
		return sortDir === 'asc' ? 'desc' : 'asc';
	}

	function handleSort(col: SortCol) {
		if (sortCol === col) {
			sortDir = toggleDir();
		} else {
			sortCol = col;
			sortDir = ASC_DEFAULT_COLS.has(col) ? 'asc' : 'desc';
		}
	}

	function si(col: string): string {
		if (sortCol !== col) return '';
		return sortDir === 'asc' ? ' ▲' : ' ▼';
	}

	type Extractor = (t: ReconTarget) => string | number;

	const SORT_EXTRACTORS: Record<SortCol, Extractor> = {
		ssid: (t) => t.ssid || '',
		rssi: (t) => t.signal_dbm || -999,
		encryption: (t) => t.encryption || '',
		channel: (t) => parseInt(t.channel || '0', 10),
		clients: (t) => t.num_clients ?? 0,
		data: (t) => t.bytes_data || 0,
		vendor: (t) => t.manufacturer || '',
		last_seen: (t) => t.last_seen || 0
	};

	function compareValues(a: string | number, b: string | number): number {
		if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
		return (a as number) - (b as number);
	}

	let sortedTargets = $derived.by(() => {
		const extract = SORT_EXTRACTORS[sortCol];
		const mult = sortDir === 'asc' ? 1 : -1;
		return [...targets].sort((a, b) => compareValues(extract(a), extract(b)) * mult);
	});

	let isLoading = $derived(reconStatus === 'loading');
</script>

<div class="intel-view">
	<div class="intel-header">
		<div class="intel-header-left">
			<span class="intel-title">{title}</span>
			<span class="intel-count">{targets.length}</span>
		</div>
		<button class="refresh-btn" onclick={onRefresh} disabled={isLoading}>
			{isLoading ? '...' : 'SCAN'}
		</button>
	</div>
	<div class="intel-desc">{description}</div>

	{#if reconStatus === 'loading'}
		<div class="loading-state">Scanning WiFi environment...</div>
	{:else if reconStatus === 'error'}
		<div class="error-state">Scan failed — click SCAN to retry</div>
	{:else if targets.length === 0}
		<div class="empty-state">No devices match this category</div>
	{:else}
		<div class="table-scroll">
			<table class="data-table data-table-compact">
				<thead>
					<tr>
						<th onclick={() => handleSort('ssid')} class="sortable col-mac"
							>SSID / MAC{si('ssid')}</th
						>
						<th onclick={() => handleSort('rssi')} class="sortable col-rssi"
							>RSSI{si('rssi')}</th
						>
						<th onclick={() => handleSort('encryption')} class="sortable col-enc"
							>ENC{si('encryption')}</th
						>
						<th onclick={() => handleSort('channel')} class="sortable col-ch"
							>CH{si('channel')}</th
						>
						<th onclick={() => handleSort('vendor')} class="sortable col-vendor"
							>VENDOR{si('vendor')}</th
						>
						<th onclick={() => handleSort('clients')} class="sortable col-clients"
							>CLIENTS{si('clients')}</th
						>
						<th onclick={() => handleSort('data')} class="sortable col-data"
							>DATA{si('data')}</th
						>
						{#each extraColumns as col}
							<th class="col-extra">{col.label}</th>
						{/each}
						<th class="col-extra">DETAILS</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedTargets as target (target.mac)}
						<tr>
							<td class="col-mac">
								<div class="cell-stack">
									<span class="cell-primary">{target.ssid || 'Hidden'}</span>
									<span class="cell-secondary">{target.mac}</span>
								</div>
							</td>
							<td class="col-rssi">
								<div class="rssi-cell">
									<span
										class="signal-indicator"
										style="background: {getSignalHex(target.signal_dbm)}"
									></span>
									<span class="rssi-value"
										>{target.signal_dbm !== 0 ? target.signal_dbm : '-'}</span
									>
								</div>
							</td>
							<td class="col-enc">
								<span class="enc-badge">{target.encryption || 'None'}</span>
							</td>
							<td class="col-ch">
								<span class="mono-value">{target.channel || '-'}</span>
							</td>
							<td class="col-vendor">
								<span class="vendor-text">{target.manufacturer || '-'}</span>
							</td>
							<td class="col-clients">
								<span class="mono-value">{target.num_clients ?? '-'}</span>
							</td>
							<td class="col-data">
								<span class="mono-value"
									>{formatDataSize(target.bytes_data || 0)}</span
								>
							</td>
							{#each extraColumns as col}
								<td class="col-extra">
									<span class="mono-value">{col.render(target)}</span>
								</td>
							{/each}
							<td class="col-extra">
								<div class="detail-tags">
									{#if target.wps_enabled}
										<span class="detail-tag critical"
											>WPS v{target.wps_version ?? '?'}</span
										>
									{/if}
									{#if target.cloaked}
										<span class="detail-tag warning">Cloaked</span>
									{/if}
									{#if target.ht_mode}
										<span class="detail-tag dim"
											>{target.ht_mode} {target.max_rate_mbps ?? ''}Mbps</span
										>
									{/if}
									{#if target.probed_ssids?.length}
										<span
											class="detail-tag"
											title={target.probed_ssids.join(', ')}
											>Probed {target.probed_ssids.length} SSIDs</span
										>
									{/if}
									{#if target.gps_bounds}
										<span class="detail-tag">GPS</span>
									{/if}
									{#if (target.retry_bytes ?? 0) > 0}
										<span class="detail-tag warning"
											>Retry {formatDataSize(target.retry_bytes ?? 0)}</span
										>
									{/if}
									{#if target.observation_secs}
										<span class="detail-tag dim"
											>{Math.round(target.observation_secs / 60)}m</span
										>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if alerts && alerts.length > 0}
		<div class="alerts-section">
			<div class="alerts-header">KISMET ALERTS ({alerts.length})</div>
			<div class="alerts-list">
				{#each alerts.slice(0, 10) as alert}
					<div class="alert-row" class:alert-high={alert.severity >= 3}>
						<span class="alert-type">{alert.type}</span>
						<span class="alert-text">{alert.text}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	@import './device-table-cells.css';
	@import './intel-category-view.css';

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

	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--foreground-muted);
	}

	tbody tr:hover {
		background: var(--surface-hover, #1e1e1e);
	}
</style>
