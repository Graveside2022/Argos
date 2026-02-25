<!-- Agent chat message bubble — renders a single message with role-based styling -->
<script lang="ts">
	import type { ChatMessage } from './agent-chat-logic.svelte.ts';

	interface Props {
		message: ChatMessage;
	}

	let { message }: Props = $props();

	const roleLabel = $derived(
		message.role === 'user' ? 'OPERATOR' : message.role === 'assistant' ? 'AGENT' : 'SYSTEM'
	);

	const formattedTime = $derived(new Date(message.timestamp).toLocaleTimeString());
</script>

<div
	class="message"
	class:user={message.role === 'user'}
	class:assistant={message.role === 'assistant'}
	class:system={message.role === 'system'}
>
	<div class="message-header">
		<span class="message-role">{roleLabel}</span>
		<span class="message-timestamp">{formattedTime}</span>
	</div>
	<div class="message-content">
		{message.content}
	</div>
</div>

<style>
	.message {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.message-role {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.5px;
	}

	.message.user .message-role {
		color: var(--chart-2);
	}

	.message.assistant .message-role {
		color: var(--chart-4);
	}

	.message.system .message-role {
		color: var(--chart-1);
	}

	.message-timestamp {
		font-size: var(--text-status);
		color: var(--muted-foreground);
	}

	.message-content {
		padding: 8px 12px;
		border-radius: 4px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message.user .message-content {
		background: var(--card);
		border: 1px solid var(--border);
	}

	.message.assistant .message-content {
		background: var(--surface-hover, #1e1e1e);
	}

	.message.system .message-content {
		background: var(--muted);
		border-left: 3px solid var(--chart-1);
		font-size: 12px;
		color: var(--muted-foreground);
	}
</style>
