<script lang="ts">
	import TerminalTabContent from './TerminalTabContent.svelte';
</script>

<div class="logs-panel">
	<div class="logs-header">
		<span class="logs-title">System Logs</span>
		<div class="pulse-indicator"></div>
	</div>
	<div class="logs-content">
		<TerminalTabContent
			sessionId="tail-argos-logs"
			shell="scripts/tmux/tmux-logs.sh"
			isActive={true}
		/>
	</div>
</div>

<style>
	.logs-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--palantir-bg-panel, #1a1a1a);
	}

	.logs-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 32px;
		min-height: 32px;
		padding: 0 var(--space-3);
		background: var(--palantir-bg-surface, #1a1a1a);
		border-bottom: 1px solid var(--palantir-border-subtle, #2e2e2e);
	}

	.logs-title {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--palantir-text-secondary);
		letter-spacing: 0.05em;
	}

	.pulse-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--palantir-success, #10b981);
		box-shadow: 0 0 8px var(--palantir-success, #10b981);
		animation: pulse 2s infinite ease-in-out;
	}

	@keyframes pulse {
		0% {
			opacity: 0.5;
			transform: scale(0.9);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
		100% {
			opacity: 0.5;
			transform: scale(0.9);
		}
	}

	.logs-content {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
