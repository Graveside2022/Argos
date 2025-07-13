<script lang="ts">
	import { connectionStatus } from '$lib/stores/hackrf';
	import { createEventDispatcher } from 'svelte';
	
	const _dispatch = createEventDispatcher();
	
	// Function to handle close action (currently unused but may be used in future)
	function _close() {
		// Implementation for closing mobile menu
	}
	
</script>

<!-- Mobile Navigation Menu -->
<div id="mobileMenu" class="lg:hidden border-t border-border-primary">
	<div class="py-4 space-y-2">
		<a href="#dashboard" class="mobile-nav-link active">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
				<path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
			</svg>
			<span class="font-heading text-body font-medium">Dashboard</span>
		</a>
		<a href="#scanner" class="mobile-nav-link">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12c0-1.594-.471-3.076-1.343-4.343a1 1 0 010-1.414z"/>
				<path fill-rule="evenodd" d="M13.828 8.172a1 1 0 011.414 0A5.983 5.983 0 0117 12a5.983 5.983 0 01-1.758 3.828 1 1 0 01-1.414-1.414A3.987 3.987 0 0015 12a3.987 3.987 0 00-1.172-2.828 1 1 0 010-1.414z"/>
			</svg>
			<span class="font-heading text-body font-medium">Frequency Scanner</span>
		</a>
		<a href="#analysis" class="mobile-nav-link">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
				<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
			</svg>
			<span class="font-heading text-body font-medium">Signal Analysis</span>
		</a>
		<a href="#settings" class="mobile-nav-link">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
			</svg>
			<span class="font-heading text-body font-medium">Settings</span>
		</a>
		<a href="#help" class="mobile-nav-link">
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
				<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
			</svg>
			<span class="font-heading text-body font-medium">Help</span>
		</a>
		
		<!-- Mobile Status Section -->
		<div class="mt-4 pt-4 border-t border-border-primary">
			<div class="px-4 py-2 glass-panel-light rounded-lg">
				<div class="flex items-center justify-between mb-2">
					<span class="font-mono text-caption text-text-muted">Status:</span>
					<div class="flex items-center space-x-2">
						<div class="status-indicator {$connectionStatus.connected ? 'status-connected' : $connectionStatus.connecting ? 'status-connecting' : 'status-disconnected'}"></div>
						<span class="font-mono text-caption text-text-secondary">
							{$connectionStatus.connected ? 'Connected' : $connectionStatus.connecting ? 'Connecting' : 'Disconnected'}
						</span>
					</div>
				</div>
				<div class="flex items-center justify-between">
					<span class="font-mono text-caption text-text-muted">Mode:</span>
					<span class="font-mono text-caption text-neon-cyan font-semibold">Sweep</span>
				</div>
			</div>
		</div>
	</div>
</div>