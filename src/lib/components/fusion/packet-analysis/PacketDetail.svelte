<script lang="ts">
	import type { AnalyzedPacket } from '$lib/stores/packetAnalysisStore';
	
	export let packet: AnalyzedPacket | null = null;
	
	function formatTimestamp(date: Date): string {
		return new Date(date).toLocaleString('en-US', {
			dateStyle: 'short',
			timeStyle: 'medium'
		});
	}
	
	function getSeverityBadge(severity: number): { color: string; label: string } {
		if (severity >= 7) return { color: 'bg-red-500/20 text-red-400', label: 'Critical' };
		if (severity >= 4) return { color: 'bg-orange-500/20 text-orange-400', label: 'Warning' };
		if (severity >= 1) return { color: 'bg-yellow-500/20 text-yellow-400', label: 'Low' };
		return { color: 'bg-accent-primary/20 text-accent-primary', label: 'Normal' };
	}
</script>

{#if packet}
	<div class="glass-panel rounded-lg p-6">
		<div class="mb-6">
			<h3 class="text-lg font-semibold text-text-primary mb-2">Packet Details</h3>
			<p class="text-sm text-text-secondary">ID: {packet.id}</p>
		</div>
		
		<!-- Basic Information -->
		<div class="grid grid-cols-2 gap-4 mb-6">
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Timestamp</h4>
				<p class="mt-1 text-sm text-text-primary">{formatTimestamp(packet.timestamp)}</p>
			</div>
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Protocol</h4>
				<p class="mt-1 text-sm text-text-primary">{packet.protocol}</p>
			</div>
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Source</h4>
				<p class="mt-1 text-sm font-mono text-text-primary">{packet.src_ip}</p>
			</div>
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Destination</h4>
				<p class="mt-1 text-sm font-mono text-text-primary">{packet.dst_ip}</p>
			</div>
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Length</h4>
				<p class="mt-1 text-sm text-text-primary">{packet.length} bytes</p>
			</div>
			<div>
				<h4 class="text-sm font-medium text-text-secondary">Info</h4>
				<p class="mt-1 text-sm text-text-primary truncate" title={packet.info}>{packet.info}</p>
			</div>
		</div>
		
		<!-- Analysis Results -->
		<div class="border-t border-border-primary pt-6">
			<h4 class="text-sm font-medium text-text-primary mb-4">Security Analysis</h4>
			
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-sm text-text-secondary">Category</span>
					<span class="text-sm font-medium capitalize text-text-primary">{packet.analysis.category}</span>
				</div>
				
				<div class="flex items-center justify-between">
					<span class="text-sm text-text-secondary">Severity</span>
					<div class="flex items-center space-x-2">
						<div class="w-24 bg-bg-secondary rounded-full h-2">
							<div 
								class="h-2 rounded-full transition-all duration-300"
								class:bg-accent-primary={packet.analysis.severity === 0}
								class:bg-yellow-400={packet.analysis.severity >= 1 && packet.analysis.severity < 4}
								class:bg-orange-400={packet.analysis.severity >= 4 && packet.analysis.severity < 7}
								class:bg-red-400={packet.analysis.severity >= 7}
								style="width: {(packet.analysis.severity / 10) * 100}%"
							></div>
						</div>
						<span class="text-sm font-medium text-text-primary">{packet.analysis.severity}/10</span>
					</div>
				</div>
				
				{#if packet.analysis.suspicionReasons.length > 0}
					<div>
						<span class="text-sm text-text-secondary block mb-1">Suspicion Reasons</span>
						<ul class="list-disc list-inside space-y-1">
							{#each packet.analysis.suspicionReasons as reason}
								<li class="text-sm text-red-400">{reason}</li>
							{/each}
						</ul>
					</div>
				{/if}
				
				{#if packet.analysis.tags.length > 0}
					<div>
						<span class="text-sm text-text-secondary block mb-1">Tags</span>
						<div class="flex flex-wrap gap-1">
							{#each packet.analysis.tags as tag}
								<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-secondary text-text-primary">
									{tag}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Raw Data Section -->
		{#if packet.data}
			<div class="border-t border-border-primary pt-6 mt-6">
				<h4 class="text-sm font-medium text-text-primary mb-2">Raw Data (First 100 bytes)</h4>
				<pre class="text-xs font-mono bg-bg-secondary p-3 rounded overflow-x-auto text-text-primary">
{packet.data.slice(0, 100)}...
				</pre>
			</div>
		{/if}
	</div>
{:else}
	<div class="glass-panel rounded-lg p-12 text-center">
		<svg class="mx-auto h-12 w-12 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
		<h3 class="mt-2 text-sm font-medium text-text-primary">No packet selected</h3>
		<p class="mt-1 text-sm text-text-secondary">Select a packet from the list to view details.</p>
	</div>
{/if}