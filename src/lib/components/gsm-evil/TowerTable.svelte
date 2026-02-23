<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import Badge from '$lib/components/ui/badge/badge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import TableRoot from '$lib/components/ui/table/table.svelte';
	import TableBody from '$lib/components/ui/table/table-body.svelte';
	import TableCell from '$lib/components/ui/table/table-cell.svelte';
	import TableHead from '$lib/components/ui/table/table-head.svelte';
	import TableHeader from '$lib/components/ui/table/table-header.svelte';
	import TableRow from '$lib/components/ui/table/table-row.svelte';
	const Table = {
		Root: TableRoot,
		Body: TableBody,
		Cell: TableCell,
		Head: TableHead,
		Header: TableHeader,
		Row: TableRow
	};
	import type { TowerGroup } from '$lib/utils/gsm-tower-utils';
	import { sortTowers } from '$lib/utils/gsm-tower-utils';

	let {
		groupedTowers = [],
		towerLookupAttempted = {},
		selectedFrequency = ''
	}: {
		groupedTowers: TowerGroup[];
		towerLookupAttempted: Record<string, boolean>;
		selectedFrequency: string;
	} = $props();

	let expandedTowers = $state<Set<string>>(new Set());
	let timestampTicker = $state(0);
	let timestampInterval: ReturnType<typeof setInterval>;

	type SortColumn =
		| 'carrier'
		| 'country'
		| 'location'
		| 'lac'
		| 'mccMnc'
		| 'devices'
		| 'lastSeen';
	let sortColumn = $state<SortColumn>('devices');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	onMount(() => {
		timestampInterval = setInterval(() => {
			timestampTicker++;
		}, 10000);
	});

	onDestroy(() => {
		if (timestampInterval) clearInterval(timestampInterval);
	});

	let sortedTowers = $derived(sortTowers([...groupedTowers], sortColumn, sortDirection));

	const columns: { col: SortColumn; label: string }[] = [
		{ col: 'carrier', label: 'Carrier' },
		{ col: 'country', label: 'Country' },
		{ col: 'location', label: 'Cell Tower Location' },
		{ col: 'lac', label: 'LAC/CI' },
		{ col: 'mccMnc', label: 'MCC-MNC' },
		{ col: 'devices', label: 'Devices' },
		{ col: 'lastSeen', label: 'Last Seen' }
	];

	/** Columns that default to descending sort order. */
	const DESC_DEFAULT_COLS = new Set<SortColumn>(['devices', 'lastSeen']);

	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortColumn = column;
		sortDirection = DESC_DEFAULT_COLS.has(column) ? 'desc' : 'asc';
	}

	function toggleTowerExpansion(towerId: string) {
		if (expandedTowers.has(towerId)) {
			expandedTowers.delete(towerId);
		} else {
			expandedTowers.add(towerId);
		}
		expandedTowers = new Set(expandedTowers);
	}

	/** Parse a timestamp string that may be in "HH:MM:SS YYYY-MM-DD" or ISO format. */
	function parseTimestamp(timestamp: string): Date {
		if (timestamp.includes(' ') && timestamp.split(' ').length === 2) {
			const [time, dateStr] = timestamp.split(' ');
			return new Date(`${dateStr}T${time}`);
		}
		return new Date(timestamp);
	}

	/** Format seconds elapsed as a relative time string. */
	const TIMESTAMP_THRESHOLDS: [number, (s: number) => string][] = [
		[
			86400,
			(s) => {
				const d = new Date(Date.now() - s * 1000);
				const timeStr = d.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
				return `${dateStr} ${timeStr}`;
			}
		],
		[3600, (s) => `${Math.floor(s / 3600)}h ago`],
		[60, (s) => `${Math.floor(s / 60)}m ago`]
	];

	function formatElapsedTime(secs: number): string {
		const match = TIMESTAMP_THRESHOLDS.find(([min]) => secs >= min);
		return match ? match[1](secs) : `${secs}s ago`;
	}

	function formatTimestamp(timestamp: string): string {
		void timestampTicker;
		const date = parseTimestamp(timestamp);
		if (isNaN(date.getTime())) return timestamp;
		return formatElapsedTime(Math.floor((Date.now() - date.getTime()) / 1000));
	}
</script>

<div class="mx-4 mt-2 bg-black/30 border border-border rounded-lg p-4">
	<h4 class="mb-4 text-center text-base font-semibold uppercase tracking-wide text-foreground">
		<span class="text-destructive">IMSI</span> Capture
	</h4>
	<div class="overflow-x-auto rounded border border-border">
		{#if sortedTowers.length > 0}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-8"></Table.Head>
						{#each columns as item}
							<Table.Head class="text-xs uppercase tracking-wide">
								<Button
									variant="ghost"
									size="sm"
									class="h-auto px-1 py-0 font-mono text-xs font-bold"
									onclick={() => handleSort(item.col)}
								>
									{item.label}
									{#if sortColumn === item.col}
										<span class="ml-1 text-blue-400 text-[0.7rem]"
											>{sortDirection === 'asc' ? '▲' : '▼'}</span
										>
									{/if}
								</Button>
							</Table.Head>
						{/each}
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each sortedTowers as tower}
						{@const towerId = `${tower.mccMnc}-${tower.lac}-${tower.ci}`}
						{@const isExpanded = expandedTowers.has(towerId)}
						<Table.Row
							class="cursor-pointer transition-colors border-l-[3px] {isExpanded
								? 'border-l-blue-500 bg-blue-500/15'
								: 'border-l-transparent'} hover:bg-muted/30 hover:border-l-blue-500"
							onclick={() => toggleTowerExpansion(towerId)}
						>
							<Table.Cell class="w-8 text-blue-500 text-[0.7rem]">
								{isExpanded ? '▼' : '▶'}
							</Table.Cell>
							<Table.Cell
								class="font-mono font-medium text-foreground {tower.carrier ===
								'Unknown'
									? 'text-yellow-500'
									: ''}"
							>
								{tower.carrier}
							</Table.Cell>
							<Table.Cell class="text-xs text-foreground">
								{tower.country.flag}
								{tower.country.code}
							</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">
								{#if tower.location}
									<span class="text-green-400"
										>{tower.location.lat.toFixed(4)}, {tower.location.lon.toFixed(
											4
										)}</span
									>
								{:else if !towerLookupAttempted[towerId]}
									<Badge
										variant="outline"
										class="text-yellow-500 border-yellow-500/30"
										>Looking up...</Badge
									>
								{:else}
									<span class="text-muted-foreground text-xs">Roaming</span>
								{/if}
							</Table.Cell>
							<Table.Cell
								class="font-mono text-xs text-muted-foreground {tower.carrier ===
								'Unknown'
									? 'text-yellow-500'
									: ''}"
							>
								{tower.lac}/{tower.ci}
							</Table.Cell>
							<Table.Cell
								class="text-xs text-muted-foreground {tower.carrier === 'Unknown'
									? 'text-yellow-500'
									: ''}"
							>
								{tower.mccMnc}
							</Table.Cell>
							<Table.Cell class="font-semibold text-blue-500">
								{tower.count}
							</Table.Cell>
							<Table.Cell class="font-mono text-xs text-muted-foreground">
								{formatTimestamp(tower.lastSeen.toISOString())}
							</Table.Cell>
						</Table.Row>
						{#if isExpanded}
							<Table.Row class="bg-black/30 hover:bg-black/30">
								<Table.Cell colspan={8} class="p-0">
									<div
										class="ml-6 my-2 rounded border-l-[3px] border-l-blue-500 p-3"
									>
										<div
											class="flex items-center gap-4 border-b border-border pb-2 mb-2 text-xs font-semibold text-muted-foreground"
										>
											<span class="flex-[2] text-emerald-500">IMSI</span>
											<span class="flex-1 text-blue-400">TMSI</span>
											<span class="flex-1 text-right">Detected</span>
										</div>
										{#each tower.devices.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) as device}
											<div
												class="flex items-center gap-4 py-2 font-mono text-xs border-b border-border/30 last:border-b-0"
											>
												<span class="flex-[2] text-emerald-500"
													>{device.imsi}</span
												>
												<span class="flex-1 text-blue-400"
													>{device.tmsi || 'N/A'}</span
												>
												<span
													class="flex-1 text-right text-muted-foreground"
												>
													{formatTimestamp(device.timestamp)}
												</span>
											</div>
										{/each}
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				</Table.Body>
			</Table.Root>
		{:else}
			<div class="flex flex-col gap-1 p-8 font-mono text-sm">
				<p class="text-muted-foreground">No IMSIs captured yet...</p>
				<p class="text-muted-foreground/60">
					Listening for mobile devices on {selectedFrequency} MHz
				</p>
				<p class="text-muted-foreground/60">
					IMSI sniffer is active - devices will appear here
				</p>
			</div>
		{/if}
	</div>
</div>
