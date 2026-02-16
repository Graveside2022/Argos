<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import type { ScanResult } from '$lib/stores/gsm-evil-store';

	let {
		scanResults = [],
		selectedFrequency = '',
		onselect
	}: {
		scanResults: ScanResult[];
		selectedFrequency: string;
		onselect: (frequency: string) => void;
	} = $props();

	function getQualityClass(strength: string): string {
		switch (strength.toLowerCase()) {
			case 'excellent':
			case 'very strong':
				return 'bg-green-500/20 text-green-400 border-green-500/30';
			case 'strong':
				return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
			case 'good':
				return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
			case 'moderate':
				return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
			case 'weak':
				return 'bg-red-500/20 text-red-400 border-red-500/30';
			default:
				return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
		}
	}
</script>

<div class="mt-4 bg-black/30 border border-border rounded-lg p-4">
	<h4 class="text-base font-semibold text-foreground mb-4 text-center uppercase tracking-wide">
		<span class="text-destructive">Scan</span> Results
	</h4>
	<div class="table-container">
		{#if scanResults.length > 0}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="text-xs uppercase tracking-wide">Frequency</Table.Head>
						<Table.Head class="text-xs uppercase tracking-wide">Signal</Table.Head>
						<Table.Head class="text-xs uppercase tracking-wide">Quality</Table.Head>
						<Table.Head class="text-xs uppercase tracking-wide">Channel Type</Table.Head
						>
						<Table.Head class="text-xs uppercase tracking-wide text-center"
							>GSM Frames</Table.Head
						>
						<Table.Head class="text-xs uppercase tracking-wide text-center"
							>Activity</Table.Head
						>
						<Table.Head class="text-xs uppercase tracking-wide">Action</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each scanResults.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0)) as result}
						<Table.Row
							class={selectedFrequency === result.frequency
								? 'bg-green-500/10 border-l-2 border-l-green-400'
								: ''}
						>
							<Table.Cell class="font-semibold font-mono text-foreground"
								>{result.frequency} MHz</Table.Cell
							>
							<Table.Cell class="text-muted-foreground font-mono"
								>{result.power !== undefined && result.power > -100
									? result.power.toFixed(1) + ' dBm'
									: result.strength || 'N/A'}</Table.Cell
							>
							<Table.Cell>
								<Badge variant="outline" class={getQualityClass(result.strength)}
									>{result.strength}</Badge
								>
							</Table.Cell>
							<Table.Cell>
								{#if result.channelType}
									<Badge
										variant={result.controlChannel ? 'secondary' : 'outline'}
										class={result.controlChannel
											? 'bg-blue-500/20 text-blue-400 border-blue-500/30 font-mono'
											: 'font-mono'}
									>
										{result.channelType}
									</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-center">
								{#if result.frameCount !== undefined}
									<span class="font-semibold text-blue-400 font-mono"
										>{result.frameCount}</span
									>
								{:else}
									<span class="text-muted-foreground italic">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-center">
								{#if result.hasGsmActivity}
									<span class="text-green-400 text-lg font-bold">✓</span>
								{:else}
									<span class="text-red-400 text-lg font-bold">✗</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<Button
									variant={selectedFrequency === result.frequency
										? 'default'
										: 'outline'}
									size="sm"
									class="uppercase text-xs"
									onclick={() => onselect(result.frequency)}
									disabled={selectedFrequency === result.frequency}
								>
									{selectedFrequency === result.frequency ? 'Selected' : 'Select'}
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else}
			<div class="flex items-center justify-center min-h-[300px] text-center">
				<p class="text-muted-foreground">No results available</p>
			</div>
		{/if}
	</div>
	{#if scanResults.length > 0}
		<p class="text-center text-xs text-muted-foreground mt-4 italic">
			Found {scanResults.length} active frequencies • Sorted by GSM frame count
		</p>
	{/if}
</div>

<style>
	.table-container {
		overflow-x: auto;
		border-radius: 0.375rem;
		border: 1px solid var(--color-border);
		min-height: 300px;
		max-height: 400px;
		overflow-y: auto;
	}
</style>
