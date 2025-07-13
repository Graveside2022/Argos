<script lang="ts">
	import { connectionStatus, sweepStatus } from '$lib/stores/hackrf';
	import { hackrfAPI } from '$lib/services/hackrf/api';
	
	async function reconnect() {
		// Attempt to reconnect by checking status
		try {
			await hackrfAPI.getStatus();
		} catch (error) {
			console.error('Reconnection failed:', error);
		}
	}
</script>

<!-- Connection Status Panel -->
<div class="glass-panel rounded-xl p-6">
	<h3 class="text-h4 font-heading font-semibold text-text-primary mb-6 flex items-center">
		<svg class="w-5 h-5 mr-2 text-accent-muted" fill="currentColor" viewBox="0 0 20 20">
			<path d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/>
		</svg>
		Connection Status
	</h3>
	
	<!-- Status Indicators -->
	<div class="space-y-4">
		<!-- HackRF Connection -->
		<div class="flex items-center justify-between p-4 glass-panel-light rounded-lg">
			<div class="flex items-center space-x-3">
				<div class="status-indicator {$connectionStatus.connected ? 'status-connected' : $connectionStatus.connecting ? 'status-connecting' : 'status-disconnected'}"></div>
				<div>
					<p class="font-mono text-body text-text-primary">HackRF Device</p>
					<p class="font-mono text-caption text-text-muted">
						{$connectionStatus.connected ? 'Connected' : $connectionStatus.connecting ? 'Connecting...' : 'Disconnected'}
					</p>
				</div>
			</div>
			{#if !$connectionStatus.connected && !$connectionStatus.connecting}
				<button 
					on:click={reconnect}
					class="px-4 py-2 glass-button rounded-lg hover:bg-bg-muted/40 transition-all duration-200"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
					</svg>
				</button>
			{/if}
		</div>
		
		<!-- Data Stream -->
		<div class="flex items-center justify-between p-4 glass-panel-light rounded-lg">
			<div class="flex items-center space-x-3">
				<div class="status-indicator {$sweepStatus.active ? 'status-connected' : 'status-disconnected'}"></div>
				<div>
					<p class="font-mono text-body text-text-primary">Data Stream</p>
					<p class="font-mono text-caption text-text-muted">
						{$sweepStatus.active ? 'Active' : 'Inactive'}
					</p>
				</div>
			</div>
			<svg class="w-4 h-4 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM12 10a1 1 0 100 2 1 1 0 000-2zm7 0a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd"/>
			</svg>
		</div>
		
		<!-- Server Connection -->
		<div class="flex items-center justify-between p-4 glass-panel-light rounded-lg">
			<div class="flex items-center space-x-3">
				<div class="status-indicator status-connected"></div>
				<div>
					<p class="font-mono text-body text-text-primary">Server Connection</p>
					<p class="font-mono text-caption text-text-muted">API Available</p>
				</div>
			</div>
			<svg class="w-4 h-4 text-neon-green" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zm-2-3.82l-2.88-2.88a1 1 0 111.414-1.414L8 11.293l4.293-4.293a1 1 0 111.414 1.414L8 14.18z" clip-rule="evenodd"/>
			</svg>
		</div>
	</div>
	
	<!-- Error Display -->
	{#if $connectionStatus.error}
		<div class="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
			<p class="font-mono text-caption text-red-400 flex items-center">
				<svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0016 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
				</svg>
				{$connectionStatus.error}
			</p>
		</div>
	{/if}
	
	<!-- System Info -->
	<div class="mt-6 pt-6 border-t border-border-primary">
		<h4 class="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">System Information</h4>
		<div class="space-y-2">
			<div class="flex justify-between">
				<span class="font-mono text-caption text-text-muted">Protocol</span>
				<span class="font-mono text-caption text-text-secondary">Server-Sent Events</span>
			</div>
			<div class="flex justify-between">
				<span class="font-mono text-caption text-text-muted">Port</span>
				<span class="font-mono text-caption text-text-secondary">5173</span>
			</div>
			<div class="flex justify-between">
				<span class="font-mono text-caption text-text-muted">Mode</span>
				<span class="font-mono text-caption text-neon-cyan font-semibold">Sweep</span>
			</div>
		</div>
	</div>
</div>