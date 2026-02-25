<!-- @constitutional-exemption Article-IV-4.3 issue:#11 — Component state handling (loading/error/empty UI) deferred to UX improvement phase -->
<script lang="ts">
	import { onMount } from 'svelte';

	import { lastInteractionEvent } from '$lib/stores/dashboard/agent-context-store';

	import {
		clearChat,
		getInputValue,
		getIsCheckingLLM,
		getIsStreaming,
		getLlmProvider,
		getMessages,
		handleInteractionEvent,
		handleKeydown,
		initializeChat,
		sendMessage,
		setChatContainer,
		setInputValue
	} from './agent-chat-logic.svelte';
	import AgentChatMessage from './AgentChatMessage.svelte';
	import AgentChatToolbar from './AgentChatToolbar.svelte';

	// Props (kept for backward compatibility — currently unused by consumer)
	interface Props {
		selectedDevice?: string;
		mapBounds?: { north: number; south: number; east: number; west: number };
		activeSignals?: number;
		userLocation?: { lat: number; lon: number };
	}

	let {
		selectedDevice: _selectedDevice = $bindable(),
		mapBounds: _mapBounds,
		activeSignals: _activeSignals,
		userLocation: _userLocation
	}: Props = $props();

	let chatContainerEl: HTMLDivElement;

	// Reactive accessors from logic module
	const messages = $derived(getMessages());
	const inputValue = $derived(getInputValue());
	const isStreaming = $derived(getIsStreaming());
	const llmProvider = $derived(getLlmProvider());
	const isCheckingLLM = $derived(getIsCheckingLLM());

	const lastMessage = $derived(messages[messages.length - 1]);
	const showTypingIndicator = $derived(
		isStreaming && lastMessage?.role === 'assistant' && !lastMessage.content
	);

	onMount(() => {
		setChatContainer(chatContainerEl);
		initializeChat();
	});

	// Auto-send device context when operator clicks a device on the map
	$effect(() => {
		handleInteractionEvent($lastInteractionEvent);
	});

	function onInput(e: Event) {
		setInputValue((e.target as HTMLTextAreaElement).value);
	}
</script>

<div class="agent-chat-panel">
	<AgentChatToolbar {llmProvider} {isCheckingLLM} onClear={clearChat} />

	<!-- Messages container -->
	<div class="chat-messages" bind:this={chatContainerEl}>
		{#each messages as message}
			<AgentChatMessage {message} />
		{/each}

		{#if showTypingIndicator}
			<div class="typing-indicator">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
		{/if}
	</div>

	<!-- Input area -->
	<div class="chat-input-area">
		<textarea
			value={inputValue}
			oninput={onInput}
			onkeydown={handleKeydown}
			placeholder={llmProvider === 'unavailable'
				? 'Agent unavailable. Configure ANTHROPIC_API_KEY in environment.'
				: 'Type a message...'}
			disabled={isStreaming || llmProvider === 'unavailable'}
			class="chat-input"
			rows="1"
		></textarea>
		<button
			class="send-btn"
			onclick={sendMessage}
			disabled={!inputValue.trim() || isStreaming || llmProvider === 'unavailable'}
			title="Send message"
		>
			{#if isStreaming}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="spin"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 6v6l4 2" />
				</svg>
			{:else}
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="22" y1="2" x2="11" y2="13" />
					<polygon points="22 2 15 22 11 13 2 9 22 2" />
				</svg>
			{/if}
		</button>
	</div>
</div>

<style>
	.agent-chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background);
		color: var(--foreground);
		font-family: var(--font-primary, monospace);
		font-size: var(--text-brand);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted-foreground);
		animation: pulse 1.4s infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		60%,
		100% {
			opacity: 0.3;
		}
		30% {
			opacity: 1;
		}
	}

	.chat-input-area {
		display: flex;
		gap: 8px;
		padding: 8px 12px;
		background: var(--card);
		border-top: 1px solid var(--border);
	}

	.chat-input {
		flex: 1;
		height: 32px;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--foreground);
		padding: 6px 12px;
		font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
		font-size: 13px;
		resize: none;
		outline: none;
	}

	.chat-input:focus {
		border-color: var(--ring);
	}

	.chat-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--interactive, #4a8af4);
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.1s;
	}

	.send-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--interactive, #4a8af4) 85%, white);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.chat-messages::-webkit-scrollbar {
		width: 10px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: var(--background);
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: var(--muted);
		border-radius: 5px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover {
		background: color-mix(in srgb, var(--muted-foreground) 50%, transparent);
	}
</style>
