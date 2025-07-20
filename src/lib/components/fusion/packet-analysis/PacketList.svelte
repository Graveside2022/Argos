<script lang="ts">
	import { analyzedPackets, flagPacketForReview } from '$lib/stores/packetAnalysisStore';
	import type { AnalyzedPacket } from '$lib/stores/packetAnalysisStore';
	
	export let maxPackets = 100;
	export let selectedPacket: AnalyzedPacket | null = null;
	
	$: displayPackets = $analyzedPackets.slice(0, maxPackets);
	
	function selectPacket(packet: AnalyzedPacket) {
		selectedPacket = packet;
	}
	
	function flagPacket(packet: AnalyzedPacket, event: Event) {
		event.stopPropagation();
		flagPacketForReview(packet.id);
	}
	
	function getSeverityColor(severity: number): string {
		if (severity >= 7) return 'text-red-400 bg-red-500/20';
		if (severity >= 4) return 'text-orange-400 bg-orange-500/20';
		if (severity >= 1) return 'text-yellow-400 bg-yellow-500/20';
		return 'text-accent-primary bg-accent-primary/20';
	}
	
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'malicious': return '🚨';
			case 'suspicious': return '⚠️';
			case 'unknown': return '❓';
			default: return '✓';
		}
	}
	
	function formatTimestamp(date: Date): string {
		return new Date(date).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}
</script>

<div class="flex flex-col h-full">
	<div class="p-4 border-b border-border-primary flex justify-between items-center">
		<h3 class="text-lg font-semibold text-text-primary">Network Packets</h3>
		<span class="text-sm text-text-secondary">
			Showing {displayPackets.length} of {$analyzedPackets.length} packets
		</span>
	</div>
	
	<div class="overflow-x-auto flex-1">
		<table class="min-w-full divide-y divide-border-primary">
			<thead class="bg-bg-secondary sticky top-0">
				<tr>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Time
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Source
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Destination
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Protocol
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Size
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Status
					</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
						Actions
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-primary">
				{#each displayPackets as packet (packet.id)}
					<tr 
						class="hover:bg-bg-hover cursor-pointer transition-colors {packet === selectedPacket ? 'bg-bg-hover' : ''}"
						on:click={() => selectPacket(packet)}
					>
						<td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-text-primary">
							{formatTimestamp(packet.timestamp)}
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-text-primary">
							{packet.src_ip}
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-text-primary">
							{packet.dst_ip}
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-primary/20 text-accent-primary">
								{packet.protocol}
							</span>
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
							{packet.length} bytes
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getSeverityColor(packet.analysis.severity)}">
								{getCategoryIcon(packet.analysis.category)} {packet.analysis.category}
							</span>
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm">
							{#if !packet.flaggedForReview}
								<button
									on:click={(e) => flagPacket(packet, e)}
									class="text-accent-primary hover:text-accent-hover"
									title="Flag for review"
								>
									🚩
								</button>
							{:else}
								<span class="text-accent-primary" title="Flagged">📌</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		
		{#if displayPackets.length === 0}
			<div class="text-center py-12 text-text-secondary">
				No packets captured yet
			</div>
		{/if}
	</div>
</div>

<style>
	table {
		font-size: 0.875rem;
	}
</style>