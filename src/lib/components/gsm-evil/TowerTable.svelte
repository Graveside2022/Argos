<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
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

	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = ['devices', 'lastSeen'].includes(column) ? 'desc' : 'asc';
		}
	}

	function toggleTowerExpansion(towerId: string) {
		if (expandedTowers.has(towerId)) {
			expandedTowers.delete(towerId);
		} else {
			expandedTowers.add(towerId);
		}
		expandedTowers = new Set(expandedTowers);
	}

	function formatTimestamp(timestamp: string): string {
		void timestampTicker;
		let date: Date;
		if (timestamp.includes(' ') && timestamp.split(' ').length === 2) {
			const [time, dateStr] = timestamp.split(' ');
			date = new Date(`${dateStr}T${time}`);
		} else {
			date = new Date(timestamp);
		}
		if (isNaN(date.getTime())) return timestamp;
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		if (diffSecs < 60) return `${diffSecs}s ago`;
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${dateStr} ${timeStr}`;
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
