<script lang="ts">
	import { securityAlerts, resolveAlert } from '$lib/stores/packetAnalysisStore';
	import type { SecurityAlert } from '$lib/stores/packetAnalysisStore';
	
	export let maxAlerts = 10;
	
	$: displayAlerts = $securityAlerts.slice(0, maxAlerts);
	$: unresolvedAlerts = displayAlerts.filter(a => !a.resolved);
	
	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'border-red-400 bg-red-500/20';
			case 'high': return 'border-orange-400 bg-orange-500/20';
			case 'medium': return 'border-yellow-400 bg-yellow-500/20';
			default: return 'border-blue-400 bg-blue-500/20';
		}
	}
	
	function getSeverityIcon(severity: string): string {
		switch (severity) {
			case 'critical': return '🚨';
			case 'high': return '⚠️';
			case 'medium': return '⚡';
			default: return 'ℹ️';
		}
	}
	
	function formatTime(date: Date): string {
		return new Date(date).toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
	
	function handleResolve(alert: SecurityAlert) {
		resolveAlert(alert.id);
	}
</script>

<div class="glass-panel rounded-lg">
	<div class="px-6 py-4 border-b border-border-primary">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-text-primary">Security Alerts</h3>
			<div class="flex items-center space-x-2">
				<span class="text-sm text-text-secondary">
					{unresolvedAlerts.length} active
				</span>
				{#if unresolvedAlerts.length > 0}
					<span class="flex h-2 w-2">
						<span class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
					</span>
				{/if}
			</div>
		</div>
	</div>
	
	<div class="max-h-96 overflow-y-auto">
		{#if displayAlerts.length === 0}
			<div class="px-6 py-12 text-center">
				<svg class="mx-auto h-12 w-12 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="mt-2 text-sm text-text-secondary">No security alerts</p>
			</div>
		{:else}
			<div class="divide-y divide-border-primary">
				{#each displayAlerts as alert (alert.id)}
					<div class="px-6 py-4 {alert.resolved ? 'opacity-50' : ''}">
						<div class="flex items-start space-x-3">
							<div class="flex-shrink-0 text-2xl">
								{getSeverityIcon(alert.severity)}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between">
									<p class="text-sm font-medium text-text-primary">
										{alert.type}
									</p>
									<p class="text-xs text-text-muted">
										{formatTime(alert.timestamp)}
									</p>
								</div>
								<p class="mt-1 text-sm text-text-secondary">
									{alert.message}
								</p>
								{#if alert.relatedPackets.length > 0}
									<p class="mt-1 text-xs text-text-muted">
										Related packets: {alert.relatedPackets.length}
									</p>
								{/if}
								{#if !alert.resolved}
									<button
										on:click={() => handleResolve(alert)}
										class="mt-2 text-xs text-accent-primary hover:text-accent-hover"
									>
										Mark as resolved
									</button>
								{:else}
									<span class="mt-2 text-xs text-accent-primary">
										✓ Resolved
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	@keyframes pulse-red {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	
	.animate-pulse-red {
		animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>