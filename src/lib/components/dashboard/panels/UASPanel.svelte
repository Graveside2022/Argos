<!--
  UAS Detection panel — bottom panel tab for DragonSync drone detection.
  Polls /api/dragonsync/status + /devices every 2s while running.
-->
<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Custom table layout tightly coupled to DragonSyncDrone shape; shadcn Table component incompatible with fixed-width column spec -->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { browser } from '$app/environment';
	import {
		fetchUASDrones,
		fetchUASStatus,
		startDragonSyncFromUi,
		stopDragonSyncFromUi,
		uasStore
	} from '$lib/stores/dragonsync/uas-store';
	import type { DragonSyncDrone } from '$lib/types/dragonsync';

	type SortKey =
		| 'id'
		| 'ua_type_name'
		| 'op_status'
		| 'lat'
		| 'lon'
		| 'alt'
		| 'height'
		| 'speed'
		| 'direction'
		| 'rssi'
		| 'transport'
		| 'make_model'
		| 'last_update_time';

	const COLUMNS: [SortKey, string][] = [
		['id', 'ID'],
		['ua_type_name', 'TYPE'],
		['op_status', 'STATUS'],
		['lat', 'LAT'],
		['lon', 'LON'],
		['alt', 'ALT'],
		['height', 'AGL'],
		['speed', 'SPD'],
		['direction', 'HDG'],
		['rssi', 'RSSI'],
		['transport', 'TRANSPORT'],
		['make_model', 'MAKE/MODEL'],
		['last_update_time', 'LAST SEEN']
	];

	const SORT_ACCESSORS: Record<SortKey, (d: DragonSyncDrone) => string | number> = {
		id: (d) => d.id,
		ua_type_name: (d) => d.ua_type_name,
		op_status: (d) => d.op_status,
		lat: (d) => d.lat,
		lon: (d) => d.lon,
		alt: (d) => d.alt,
		height: (d) => d.height,
		speed: (d) => d.speed,
		direction: (d) => d.direction ?? -999,
		rssi: (d) => d.rssi,
		transport: (d) => d.transport,
		make_model: (d) => `${d.rid.make ?? ''} ${d.rid.model ?? ''}`.trim(),
		last_update_time: (d) => d.last_update_time
	};

	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let starting = $state(false);
	let stopping = $state(false);
	let sortKey: SortKey = $state('rssi');
	let sortDir: 'asc' | 'desc' = $state('desc');

	function syncPollTimer(running: boolean): void {
		if (running && !pollTimer) {
			pollTimer = setInterval(() => {
				void fetchUASStatus();
				void fetchUASDrones();
			}, 2000);
		} else if (!running && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	$effect(() => {
		syncPollTimer($uasStore.status === 'running' || $uasStore.status === 'starting');
	});

	onMount(() => {
		if (!browser) return;
		void fetchUASStatus();
		void fetchUASDrones();
	});
	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function onStart(): Promise<void> {
		starting = true;
		try {
			await startDragonSyncFromUi();
		} finally {
			starting = false;
		}
	}

	async function onStop(): Promise<void> {
		stopping = true;
		try {
			await stopDragonSyncFromUi();
		} finally {
			stopping = false;
		}
	}

	function handleSort(col: SortKey): void {
		if (sortKey === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortKey = col;
		sortDir = col === 'id' ? 'asc' : 'desc';
	}

	function sortInd(col: SortKey): string {
		return sortKey !== col ? '' : sortDir === 'asc' ? ' ^' : ' v';
	}

	function sorted(map: Map<string, DragonSyncDrone>): DragonSyncDrone[] {
		return Array.from(map.values()).sort((a, b) => {
			const fn = SORT_ACCESSORS[sortKey];
			const va = fn(a),
				vb = fn(b);
			return (sortDir === 'asc' ? 1 : -1) * (va < vb ? -1 : va > vb ? 1 : 0);
		});
	}

	function ago(ts: number): string {
		const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (s < 60) return `${s}s ago`;
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		return `${Math.floor(s / 3600)}h ago`;
	}

	function rssiCls(dbm: number): string {
		if (dbm >= -50) return 'rssi-strong';
		if (dbm >= -70) return 'rssi-moderate';
		return dbm >= -90 ? 'rssi-weak' : 'rssi-none';
	}

	function chipCls(s: string): string {
		if (s === 'running') return 'chip-run';
		return s === 'starting' || s === 'stopping' ? 'chip-trans' : 'chip-stop';
	}

	function mm(d: DragonSyncDrone): string {
		const p = [d.rid.make, d.rid.model].filter(Boolean);
		return p.length > 0 ? p.join(' ') : '--';
	}

	function trunc(s: string, n: number): string {
		return s.length > n ? s.slice(0, n) + '...' : s;
	}

	const FORMATTERS: Record<SortKey, (d: DragonSyncDrone) => string> = {
		id: (d) => trunc(d.id, 16),
		ua_type_name: (d) => d.ua_type_name || '--',
		op_status: (d) => d.op_status || '--',
		lat: (d) => d.lat.toFixed(6),
		lon: (d) => d.lon.toFixed(6),
		alt: (d) => `${d.alt.toFixed(0)}m`,
		height: (d) => `${d.height.toFixed(0)}m`,
		speed: (d) => `${d.speed.toFixed(1)} m/s`,
		direction: (d) => (d.direction != null ? `${d.direction}\u00B0` : '--'),
		rssi: (d) => `${d.rssi} dBm`,
		transport: (d) => d.transport || '--',
		make_model: (d) => mm(d),
		last_update_time: (d) => ago(d.last_update_time)
	};

	function cell(d: DragonSyncDrone, k: SortKey): string {
		return FORMATTERS[k](d);
	}
</script>

<div class="panel">
	<div class="toolbar">
		<span class="title">UAS DETECTION</span>
		<span class="chip {chipCls($uasStore.status)}">{$uasStore.status.toUpperCase()}</span>
		<span class="svc"
			>droneid-go <span class="dot" class:up={$uasStore.droneidGoRunning}></span></span
		>
		<span class="svc"
			>DragonSync <span class="dot" class:up={$uasStore.dragonSyncRunning}></span></span
		>
		<span class="spacer"></span>
		<span class="count">{$uasStore.droneCount} drones</span>
		{#if $uasStore.status === 'stopped'}
			<button class="btn-start" onclick={onStart} disabled={starting}>
				{starting ? 'Starting...' : 'Start'}
			</button>
		{:else}
			<button class="btn-stop" onclick={onStop} disabled={stopping}>
				{stopping ? 'Stopping...' : 'Stop'}
			</button>
		{/if}
	</div>

	{#if $uasStore.error}<div class="error-banner">{$uasStore.error}</div>{/if}

	{#if $uasStore.drones.size === 0}
		<div class="empty">
			<p class="empty-title">No drones detected</p>
			<p class="empty-sub">
				{$uasStore.status === 'stopped'
					? 'Click Start to begin UAS detection via DragonSync'
					: 'Listening for Remote ID broadcasts...'}
			</p>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead
					><tr>
						{#each COLUMNS as [key, label] (key)}
							<th class="sortable" onclick={() => handleSort(key)}
								>{label}{sortInd(key)}</th
							>
						{/each}
					</tr></thead
				>
				<tbody>
					{#each sorted($uasStore.drones) as d (d.id)}
						<tr>
							{#each COLUMNS as [key] (key)}
								<td class={key === 'rssi' ? rssiCls(d.rssi) : 'dim'}
									>{cell(d, key)}</td
								>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	@import './uas-panel.css';
</style>
