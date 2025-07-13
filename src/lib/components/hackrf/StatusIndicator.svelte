<script lang="ts">
	import { connectionStatus } from '$lib/stores/hackrf';
</script>

<div class="flex items-center space-x-2">
	<div class="status-indicator {$connectionStatus.connected ? 'status-connected' : $connectionStatus.connecting ? 'status-connecting' : 'status-disconnected'}"></div>
	<span class="font-mono text-xs text-text-secondary">
		{$connectionStatus.connected ? 'Connected' : $connectionStatus.connecting ? 'Connecting' : 'Disconnected'}
	</span>
</div>