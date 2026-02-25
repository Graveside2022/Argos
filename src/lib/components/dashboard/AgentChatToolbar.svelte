<!-- Agent chat toolbar — status badge and clear button -->
<script lang="ts">
	interface Props {
		llmProvider: 'anthropic' | 'unavailable';
		isCheckingLLM: boolean;
		onClear: () => void;
	}

	let { llmProvider, isCheckingLLM, onClear }: Props = $props();
</script>

<div class="chat-toolbar">
	<div class="toolbar-left">
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			class="agent-icon"
		>
			<path d="M12 2L2 7l10 5 10-5-10-5z" />
			<path d="M2 17l10 5 10-5" />
			<path d="M2 12l10 5 10-5" />
		</svg>
		<span class="toolbar-title">Argos Agent</span>
		{#if !isCheckingLLM}
			<span class="llm-badge" class:online={llmProvider !== 'unavailable'}>
				{llmProvider === 'anthropic' ? 'Claude' : 'Offline'}
			</span>
		{/if}
	</div>
	<div class="toolbar-right">
		<button class="toolbar-btn" title="Clear chat" onclick={onClear}>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="3 6 5 6 21 6" />
				<path
					d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
				/>
			</svg>
		</button>
	</div>
</div>

<style>
	.chat-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 36px;
		min-height: 36px;
		padding: 0 12px;
		background: var(--card);
		border-bottom: 1px solid var(--border);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.agent-icon {
		color: var(--interactive, #4a8af4);
	}

	.toolbar-title {
		color: var(--foreground);
		font-weight: 500;
	}

	.llm-badge {
		padding: 2px 8px;
		border-radius: 3px;
		background: var(--border);
		color: var(--muted-foreground);
		font-size: 11px;
		text-transform: uppercase;
	}

	.llm-badge.online {
		background: color-mix(in srgb, var(--success) 20%, transparent);
		color: var(--success);
	}

	.toolbar-right {
		display: flex;
		gap: 4px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.1s;
	}

	.toolbar-btn:hover {
		background: var(--surface-hover, #1e1e1e);
		color: var(--foreground);
	}
</style>
