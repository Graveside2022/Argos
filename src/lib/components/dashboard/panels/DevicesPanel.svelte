<script lang="ts">
	import { getContext } from 'svelte';
	import { kismetStore, setWhitelistMAC } from '$lib/stores/tactical-map/kismet-store';
	import { getSignalBandKey, getSignalHex, signalBands } from '$lib/utils/signal-utils';
	import type { KismetDevice } from '$lib/types/kismet';

	const dashboardMap = getContext<
		{ flyTo: (lat: number, lon: number, zoom?: number) => void } | undefined
	>('dashboardMap');

	let searchQuery = $state('');
	let whitelistInput = $state('');
	let whitelistedMACs: string[] = $state([]);
	let sortColumn: 'mac' | 'rssi' | 'type' = $state('rssi');
	let sortDirection: 'asc' | 'desc' = $state('desc');
	let selectedMAC: string | null = $state(null);
	let hiddenBands = $state(new Set<string>());

	function toggleBand(key: string) {
		if (hiddenBands.has(key)) {
			hiddenBands.delete(key);
		} else {
			hiddenBands.add(key);
		}
		hiddenBands = new Set(hiddenBands);
	}

	function handleSort(col: 'mac' | 'rssi' | 'type') {
		if (sortColumn === col) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = col;
			sortDirection = col === 'mac' ? 'asc' : 'desc';
		}
	}

	function addToWhitelist() {
		const mac = whitelistInput.trim().toUpperCase();
		if (mac && !whitelistedMACs.includes(mac)) {
			whitelistedMACs = [...whitelistedMACs, mac];
			setWhitelistMAC(mac);
			whitelistInput = '';
		}
	}

	function removeFromWhitelist(mac: string) {
		whitelistedMACs = whitelistedMACs.filter((m) => m !== mac);
	}

	function handleRowClick(device: KismetDevice) {
		selectedMAC = device.mac;
		const lat = device.location?.lat;
		const lon = device.location?.lon;
		if (lat && lon && dashboardMap) {
			dashboardMap.flyTo(lat, lon, 17);
		}
	}

	// Filtered and sorted devices
	let devices = $derived.by(() => {
		const all = Array.from($kismetStore.devices.values());
		const q = searchQuery.toLowerCase().trim();

		return all
			.filter((d) => {
				// Kismet reports 0 dBm for devices with no signal data — treat as no-data
				const rssi = d.signal?.last_signal || -100;
				const band = getSignalBandKey(rssi);
				if (hiddenBands.has(band)) return false;
				if (!q) return true;
				const mac = (d.mac || '').toLowerCase();
				const ssid = (d.ssid || '').toLowerCase();
				const mfr = (d.manufacturer || d.manuf || '').toLowerCase();
				return mac.includes(q) || ssid.includes(q) || mfr.includes(q);
			})
			.sort((a, b) => {
				let cmp = 0;
				if (sortColumn === 'mac') {
					cmp = (a.mac || '').localeCompare(b.mac || '');
				} else if (sortColumn === 'rssi') {
					// 0 dBm = no data, sort below real signals
					cmp = (b.signal?.last_signal || -100) - (a.signal?.last_signal || -100);
				} else if (sortColumn === 'type') {
					const order: Record<string, number> = { ap: 0, client: 1 };
					cmp = (order[a.type] ?? 2) - (order[b.type] ?? 2);
				}
				return sortDirection === 'asc' ? cmp : -cmp;
			});
	});

	function sortIndicator(col: string): string {
		if (sortColumn !== col) return '';
		return sortDirection === 'asc' ? ' ^' : ' v';
	}
</script>

<div class="devices-panel">
	<header class="panel-header">
		<span class="panel-title">DEVICES</span>
		<span class="device-count">{devices.length}</span>
	</header>

	<!-- Search -->
	<div class="search-bar">
		<input
			class="input-field input-field-sm"
			type="text"
			placeholder="Search MAC, SSID, manufacturer..."
			bind:value={searchQuery}
		/>
	</div>

	<!-- Signal band filter -->
	<div class="band-filters">
		{#each signalBands as band (band.key)}
			<button
				class="band-chip"
				class:hidden-band={hiddenBands.has(band.key)}
				onclick={() => toggleBand(band.key)}
				title={band.label}
			>
				<span class="band-dot" style="background: var({band.cssVar})"></span>
			</button>
		{/each}
	</div>

	<!-- Device table -->
	<div class="table-scroll">
		<table class="data-table data-table-compact">
			<thead>
				<tr>
					<th onclick={() => handleSort('mac')} class="sortable" style="width:45%"
						>MAC / SSID{sortIndicator('mac')}</th
					>
					<th onclick={() => handleSort('rssi')} class="sortable" style="width:25%"
						>RSSI{sortIndicator('rssi')}</th
					>
					<th onclick={() => handleSort('type')} class="sortable" style="width:30%"
						>TYPE{sortIndicator('type')}</th
					>
				</tr>
			</thead>
			<tbody>
				{#each devices as device (device.mac)}
					<tr
						class:selected={selectedMAC === device.mac}
						onclick={() => handleRowClick(device)}
					>
						<td>
							<div class="cell-stack">
								<span class="cell-primary">{device.ssid || 'Hidden'}</span>
								<span class="cell-secondary">{device.mac}</span>
							</div>
						</td>
						<td>
							<div class="rssi-cell">
								<span
									class="signal-indicator"
									style="background: {getSignalHex(
										device.signal?.last_signal || -100
									)}"
								></span>
								<span class="rssi-value"
									>{device.signal?.last_signal
										? device.signal.last_signal
										: '-'}</span
								>
							</div>
						</td>
						<td>
							<span class="type-badge">{device.type || '-'}</span>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="3" class="empty-row">
							{#if $kismetStore.status !== 'running'}
								Start Kismet to see devices
							{:else}
								No devices match filters
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Whitelist -->
	<section class="whitelist-section">
		<div class="section-label">WHITELIST ({whitelistedMACs.length})</div>

		<div class="whitelist-input-row">
			<input
				class="input-field input-field-sm"
				type="text"
				placeholder="MAC address..."
				bind:value={whitelistInput}
				onkeydown={(e) => e.key === 'Enter' && addToWhitelist()}
			/>
			<button class="btn btn-secondary btn-sm" onclick={addToWhitelist}>Add</button>
		</div>

		{#if whitelistedMACs.length > 0}
			<div class="whitelist-items">
				{#each whitelistedMACs as mac (mac)}
					<div class="whitelist-item">
						<span class="whitelist-mac">{mac}</span>
						<button class="whitelist-remove" onclick={() => removeFromWhitelist(mac)}>
							<svg
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="18" y1="6" x2="6" y2="18" /><line
									x1="6"
									y1="6"
									x2="18"
									y2="18"
								/>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.devices-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.device-count {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-accent);
		font-variant-numeric: tabular-nums;
	}

	.search-bar {
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.band-filters {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.band-chip {
		width: 24px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--palantir-border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.band-chip.hidden-band {
		opacity: 0.25;
	}

	.band-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.table-scroll {
		flex: 1;
		overflow-y: auto;
	}

	.sortable {
		cursor: pointer;
		user-select: none;
	}

	.sortable:hover {
		color: var(--palantir-text-secondary);
	}

	.cell-stack {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.cell-primary {
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-secondary {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--palantir-text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rssi-cell {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.rssi-value {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}

	.type-badge {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--palantir-text-secondary);
	}

	.empty-row {
		text-align: center;
		color: var(--palantir-text-tertiary);
		font-style: italic;
		padding: var(--space-6) var(--space-3) !important;
	}

	/* Whitelist */
	.whitelist-section {
		padding: var(--space-3);
		border-top: 1px solid var(--palantir-border-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
	}

	.whitelist-input-row {
		display: flex;
		gap: var(--space-2);
	}

	.whitelist-input-row .input-field {
		flex: 1;
	}

	.whitelist-items {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.whitelist-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		background: var(--palantir-bg-elevated);
		border-radius: var(--radius-sm);
	}

	.whitelist-mac {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--palantir-text-primary);
	}

	.whitelist-remove {
		background: none;
		border: none;
		color: var(--palantir-text-tertiary);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
	}

	.whitelist-remove:hover {
		color: var(--palantir-error);
	}
</style>
