<script lang="ts">
	import { protocolStats, suspiciousActivity, activeConversations } from '$lib/stores/packetAnalysisStore';
	
	function getAlertColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'text-red-600 bg-red-50';
			case 'high': return 'text-orange-600 bg-orange-50';
			case 'medium': return 'text-yellow-600 bg-yellow-50';
			default: return 'text-green-600 bg-green-50';
		}
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
	<!-- Suspicious Activity Card -->
	<div class="glass-panel rounded-lg p-6">
		<div class="flex items-center">
			<div class="flex-shrink-0">
				<svg class="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
			</div>
			<div class="ml-4">
				<h3 class="text-sm font-medium text-text-primary">Suspicious Packets</h3>
				<p class="text-2xl font-semibold text-red-400">{$suspiciousActivity.suspiciousPackets}</p>
			</div>
		</div>
	</div>
	
	<!-- Malicious Activity Card -->
	<div class="glass-panel rounded-lg p-6">
		<div class="flex items-center">
			<div class="flex-shrink-0">
				<svg class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
				</svg>
			</div>
			<div class="ml-4">
				<h3 class="text-sm font-medium text-text-primary">Malicious Packets</h3>
				<p class="text-2xl font-semibold text-red-500">{$suspiciousActivity.maliciousPackets}</p>
			</div>
		</div>
	</div>
	
	<!-- Active Alerts Card -->
	<div class="glass-panel rounded-lg p-6">
		<div class="flex items-center">
			<div class="flex-shrink-0">
				<svg class="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
			</div>
			<div class="ml-4">
				<h3 class="text-sm font-medium text-text-primary">Active Alerts</h3>
				<p class="text-2xl font-semibold text-yellow-400">{$suspiciousActivity.unresolvedAlerts}</p>
				<div class="mt-1 flex space-x-2 text-xs">
					{#if $suspiciousActivity.criticalAlerts > 0}
						<span class="text-red-500">{$suspiciousActivity.criticalAlerts} critical</span>
					{/if}
					{#if $suspiciousActivity.highAlerts > 0}
						<span class="text-orange-500">{$suspiciousActivity.highAlerts} high</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
	
	<!-- Active Conversations Card -->
	<div class="glass-panel rounded-lg p-6">
		<div class="flex items-center">
			<div class="flex-shrink-0">
				<svg class="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
				</svg>
			</div>
			<div class="ml-4">
				<h3 class="text-sm font-medium text-text-primary">Active Flows</h3>
				<p class="text-2xl font-semibold text-blue-400">{$activeConversations.length}</p>
			</div>
		</div>
	</div>
</div>

<!-- Protocol Distribution -->
<div class="glass-panel rounded-lg p-6 mb-6">
	<h3 class="text-lg font-semibold text-text-primary mb-4">Protocol Distribution</h3>
	<div class="space-y-2">
		{#each $protocolStats.slice(0, 5) as stat}
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<span class="text-sm font-medium text-text-primary">{stat.protocol}</span>
					<span class="text-xs text-text-secondary">({stat.count} packets)</span>
				</div>
				<div class="flex items-center space-x-2">
					<div class="w-32 bg-bg-secondary rounded-full h-2">
						<div 
							class="bg-accent-primary h-2 rounded-full transition-all duration-300"
							style="width: {stat.percentage}%"
						></div>
					</div>
					<span class="text-sm text-text-secondary w-12 text-right">{stat.percentage.toFixed(1)}%</span>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Top Conversations -->
<div class="glass-panel rounded-lg p-6">
	<h3 class="text-lg font-semibold text-text-primary mb-4">Top Network Conversations</h3>
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-border-primary">
			<thead>
				<tr>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Source → Destination</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Packets</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Data</th>
					<th class="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-primary">
				{#each $activeConversations.slice(0, 5) as conv}
					<tr>
						<td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-text-primary">
							{conv.src_ip} → {conv.dst_ip}
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
							{conv.packetCount}
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm text-text-primary">
							{(conv.bytesTransferred / 1024).toFixed(2)} KB
						</td>
						<td class="px-3 py-2 whitespace-nowrap text-sm">
							{#if conv.suspicious}
								<span class="text-red-400">⚠️ Suspicious</span>
							{:else}
								<span class="text-accent-primary">✓ Normal</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>