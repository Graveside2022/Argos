<!--
  Bluetooth panel — bottom panel tab content showing Blue Dragon captured BLE/BT devices.
  Uses proper HTML table with sortable column headers matching Wi-Fi tab pattern.
  Polls /api/bluedragon/status + /devices every 2s while Blue Dragon is running.
-->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Custom table layout tightly coupled to BluetoothDevice shape; shadcn Table component incompatible with fixed-width column spec -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import {
		applyBluetoothDevices,
		bluetoothStore,
		fetchBluetoothDevices,
		fetchBluetoothStatus,
		startBluedragonFromUi,
		stopBluedragonFromUi
	} from '$lib/stores/bluedragon/bluetooth-store';
	import type { BluedragonProfile, BluetoothDevice } from '$lib/types/bluedragon';

	type SortKey =
		| 'addr'
		| 'vendor'
		| 'product'
		| 'category'
		| 'phy'
		| 'rssi'
		| 'pkts'
		| 'first'
		| 'last';

	let profile: BluedragonProfile = $state('volume');
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let starting = $state(false);
	let stopping = $state(false);
	let sortKey: SortKey = $state('last');
	let sortDir: 'asc' | 'desc' = $state('desc');

	function syncPollTimer(isRunning: boolean): void {
		if (isRunning && !pollTimer) {
			void fetchBluetoothDevices();
			pollTimer = setInterval(() => {
				void fetchBluetoothStatus();
				void fetchBluetoothDevices();
			}, 2000);
		} else if (!isRunning && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	$effect(() => {
		const isRunning =
			$bluetoothStore.status === 'running' || $bluetoothStore.status === 'starting';
		syncPollTimer(isRunning);
	});

	onMount(() => {
		if (!browser) return;
		void fetchBluetoothStatus();
		void fetchBluetoothDevices();
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function onStart(): Promise<void> {
		starting = true;
		try {
			await startBluedragonFromUi(profile);
		} finally {
			starting = false;
		}
	}

	async function onStop(): Promise<void> {
		stopping = true;
		try {
			await stopBluedragonFromUi();
		} finally {
			stopping = false;
		}
	}

	async function onClear(): Promise<void> {
		await fetch('/api/bluedragon/devices/reset', {
			method: 'POST',
			credentials: 'same-origin'
		});
		applyBluetoothDevices([]);
	}

	function handleSort(col: SortKey): void {
		if (sortKey === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = col;
		sortDir = col === 'addr' ? 'asc' : 'desc';
	}

	function sortIndicator(col: SortKey): string {
		if (sortKey !== col) return '';
		return sortDir === 'asc' ? ' ^' : ' v';
	}

	const SORT_ACCESSORS: Record<SortKey, (d: BluetoothDevice) => string | number> = {
		addr: (d) => d.addr,
		vendor: (d) => d.vendor ?? '',
		product: (d) => d.product ?? '',
		category: (d) => d.category,
		phy: (d) => d.phy,
		rssi: (d) => d.rssiAvg ?? -999,
		pkts: (d) => d.packetCount,
		first: (d) => d.firstSeen,
		last: (d) => d.lastSeen
	};

	function compareDevices(a: BluetoothDevice, b: BluetoothDevice): number {
		const accessor = SORT_ACCESSORS[sortKey];
		const va = accessor(a);
		const vb = accessor(b);
		const cmp = va < vb ? -1 : va > vb ? 1 : 0;
		return sortDir === 'asc' ? cmp : -cmp;
	}

	function sortedDevices(map: Map<string, BluetoothDevice>): BluetoothDevice[] {
		return Array.from(map.values()).sort(compareDevices);
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
	}

	function rssiClass(dbm: number | null): string {
		if (dbm == null) return 'rssi-none';
		if (dbm >= -50) return 'rssi-strong';
		if (dbm >= -70) return 'rssi-moderate';
		if (dbm >= -85) return 'rssi-weak';
		return 'rssi-none';
	}

	function formatRssi(dbm: number | null): string {
		return dbm == null ? '—' : `${dbm.toFixed(0)} dBm`;
	}

	function statusClass(status: string): string {
		if (status === 'running') return 'chip-running';
		if (status === 'starting' || status === 'stopping') return 'chip-transition';
		return 'chip-stopped';
	}

	function setElWidth(el: HTMLElement, w: string): void {
		el.style.width = w;
		el.style.minWidth = w;
		el.style.maxWidth = w;
	}

	function startResizeDrag(col: HTMLElement, startX: number): void {
		const startWidth = col.offsetWidth;
		const colIdx = Array.from(col.parentElement?.children ?? []).indexOf(col);
		const table = col.closest('table');

		function onMove(ev: MouseEvent): void {
			const w = `${Math.max(60, startWidth + ev.clientX - startX)}px`;
			setElWidth(col, w);
			if (!table) return;
			for (const row of table.querySelectorAll('tbody tr')) {
				const td = row.children[colIdx] as HTMLElement | undefined;
				if (td) setElWidth(td, w);
			}
		}

		function onUp(): void {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}

	function initResize(e: MouseEvent): void {
		e.stopPropagation();
		e.preventDefault();
		const handle = e.target as HTMLElement;
		const col = handle.parentElement;
		if (col) startResizeDrag(col, e.clientX);
	}
</script>

<div class="bluetooth-panel">
	<div class="toolbar">
		<span class="title">BLUETOOTH</span>
		<span class="chip {statusClass($bluetoothStore.status)}"
			>{$bluetoothStore.status.toUpperCase()}</span
		>
		{#if $bluetoothStore.status === 'running'}
			<span class="profile-tag">{$bluetoothStore.profile ?? 'volume'}</span>
		{/if}
		<span class="spacer"></span>
		<span class="count">{$bluetoothStore.deviceCount} devices</span>
		<span class="packets">{$bluetoothStore.packetCount} pkts</span>
		{#if $bluetoothStore.status === 'stopped'}
			<select class="profile-select" bind:value={profile} disabled={starting}>
				<option value="clean">CLEAN (98% CRC)</option>
				<option value="volume">VOLUME (recommended)</option>
				<option value="max">MAX DECODE</option>
			</select>
			<button class="btn-start" onclick={onStart} disabled={starting}>
				{starting ? 'Starting…' : 'Start'}
			</button>
		{:else}
			<button class="btn-stop" onclick={onStop} disabled={stopping}>
				{stopping ? 'Stopping…' : 'Stop'}
			</button>
		{/if}
		<button class="btn-clear" onclick={onClear}>Clear</button>
	</div>

	{#if $bluetoothStore.error}
		<div class="error-banner">{$bluetoothStore.error}</div>
	{/if}

	{#if $bluetoothStore.status === 'stopped' && $bluetoothStore.devices.size === 0}
		<div class="empty">
			<p class="empty-title">Blue Dragon not running</p>
			<p class="empty-sub">
				Select a profile and click Start to begin wideband BLE/BT capture
			</p>
		</div>
	{:else if $bluetoothStore.devices.size === 0}
		<div class="empty">
			<p class="empty-title">Capturing…</p>
			<p class="empty-sub">Waiting for first packets</p>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th onclick={() => handleSort('addr')} class="sortable"
							>ADDRESS{sortIndicator('addr')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('vendor')} class="sortable"
							>VENDOR{sortIndicator('vendor')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('product')} class="sortable"
							>PRODUCT{sortIndicator('product')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('category')} class="sortable"
							>CATEGORY{sortIndicator('category')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th>FLAGS<span class="resize-handle" onmousedown={initResize}></span></th>
						<th onclick={() => handleSort('phy')} class="sortable"
							>PHY{sortIndicator('phy')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('rssi')} class="sortable"
							>RSSI{sortIndicator('rssi')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('pkts')} class="sortable"
							>PKTS{sortIndicator('pkts')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('first')} class="sortable"
							>FIRST{sortIndicator('first')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
						<th onclick={() => handleSort('last')} class="sortable"
							>LAST{sortIndicator('last')}<span
								class="resize-handle"
								onmousedown={initResize}
							></span></th
						>
					</tr>
				</thead>
				<tbody>
					{#each sortedDevices($bluetoothStore.devices) as device (device.addr)}
						<tr>
							<td class="col-addr">{device.addr}</td>
							<td class="col-vendor">{device.vendor ?? '—'}</td>
							<td class="col-product">{device.product ?? '—'}</td>
							<td class="col-cat">{device.category}</td>
							<td class="col-flags">
								{#if device.isIbeacon}<span class="badge">iBeacon</span>{/if}
								{#if device.isAirtag}<span class="badge badge-warn">AirTag</span
									>{/if}
								{#if device.bdClassic}<span class="badge">BR/EDR</span>{/if}
							</td>
							<td class="col-phy">{device.phy}</td>
							<td class="col-rssi {rssiClass(device.rssiAvg)}"
								>{formatRssi(device.rssiAvg)}</td
							>
							<td class="col-pkts">{device.packetCount}</td>
							<td class="col-time">{formatTime(device.firstSeen)}</td>
							<td class="col-time">{formatTime(device.lastSeen)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.bluetooth-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		font-family: var(--font-mono, 'Fira Code', monospace);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 12px;
		height: 36px;
		min-height: 36px;
		border-bottom: 1px solid var(--border);
	}

	.title {
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground-secondary);
		letter-spacing: 1.5px;
	}

	.chip {
		padding: 2px 8px;
		border-radius: 3px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.8px;
	}

	.chip-running {
		background: var(--status-healthy, #8bbfa0);
		color: var(--background);
	}

	.chip-stopped {
		background: var(--surface-hover);
		color: var(--muted-foreground);
	}

	.chip-transition {
		background: var(--status-warning, #d4a054);
		color: var(--background);
	}

	.profile-tag {
		font-size: 12px;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}

	.spacer {
		flex: 1;
	}

	.count,
	.packets {
		font-size: 14px;
		color: var(--muted-foreground);
	}

	.profile-select {
		font-size: 13px;
		padding: 2px 6px;
		background: var(--card);
		border: 1px solid var(--border);
		color: var(--foreground);
		font-family: inherit;
	}

	.btn-start,
	.btn-stop,
	.btn-clear {
		padding: 4px 14px;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.8px;
		border: 1px solid var(--border);
		cursor: pointer;
		font-family: inherit;
	}

	.btn-start {
		background: color-mix(in srgb, var(--status-healthy, #8bbfa0) 20%, var(--card));
		color: var(--status-healthy, #8bbfa0);
		border-color: color-mix(in srgb, var(--status-healthy, #8bbfa0) 40%, var(--border));
	}

	.btn-start:hover:not(:disabled) {
		background: color-mix(in srgb, var(--status-healthy, #8bbfa0) 30%, var(--card));
	}

	.btn-stop {
		background: color-mix(in srgb, var(--status-error-panel, #c45b4a) 20%, var(--card));
		color: var(--status-error-panel, #c45b4a);
		border-color: color-mix(in srgb, var(--status-error-panel, #c45b4a) 40%, var(--border));
	}

	.btn-stop:hover:not(:disabled) {
		background: color-mix(in srgb, var(--status-error-panel, #c45b4a) 30%, var(--card));
	}

	.btn-clear {
		background: var(--card);
		color: var(--muted-foreground);
	}

	.btn-clear:hover {
		background: var(--surface-hover);
		color: var(--foreground);
	}

	.btn-start:disabled,
	.btn-stop:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-banner {
		padding: 4px 12px;
		font-size: 11px;
		background: var(--status-error-panel, #c45b4a);
		color: var(--background);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		gap: 4px;
	}

	.empty-title {
		font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
		font-size: 16px;
		color: var(--foreground-secondary);
		margin: 0;
	}

	.empty-sub {
		font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
		font-size: 13px;
		color: var(--muted-foreground);
		margin: 0;
	}

	.table-wrap {
		flex: 1;
		overflow-y: auto;
		overflow-x: auto;
	}

	table {
		border-collapse: collapse;
		width: max-content;
	}

	thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--surface-header, var(--card));
	}

	th {
		padding: 6px 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground-secondary);
		letter-spacing: 0.8px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		user-select: none;
	}

	th.sortable {
		cursor: pointer;
	}

	th {
		position: relative;
	}

	th.sortable:hover {
		color: var(--foreground);
		background: var(--surface-hover);
	}

	.resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: col-resize;
		background: transparent;
	}

	.resize-handle:hover {
		background: var(--primary);
		opacity: 0.4;
	}

	td {
		padding: 5px 10px;
		font-size: 16px;
		color: var(--foreground);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 250px;
	}

	tr:hover td {
		background: var(--surface-hover);
	}

	.col-cat,
	.col-phy,
	.col-pkts,
	.col-time {
		color: var(--foreground-secondary);
	}

	.badge {
		display: inline-block;
		padding: 2px 6px;
		font-size: 10px;
		background: var(--surface-hover);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--foreground-secondary);
		margin-right: 4px;
	}

	.badge-warn {
		color: var(--status-warning, #d4a054);
	}

	.rssi-strong {
		color: var(--status-healthy, #8bbfa0);
	}

	.rssi-moderate {
		color: var(--primary);
	}

	.rssi-weak {
		color: var(--status-warning, #d4a054);
	}

	.rssi-none {
		color: var(--foreground-tertiary);
	}
</style>
