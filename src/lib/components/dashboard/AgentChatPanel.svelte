<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { browser } from '$app/environment';
	import { agentContext, lastInteractionEvent } from '$lib/stores/dashboard/agent-context-store';

	// Props are no longer needed - context comes from store
	interface Props {
		selectedDevice?: string;
		mapBounds?: { north: number; south: number; east: number; west: number };
		activeSignals?: number;
		userLocation?: { lat: number; lon: number };
	}

	let {
		selectedDevice = $bindable(),
		mapBounds: _mapBounds,
		activeSignals: _activeSignals,
		userLocation: _userLocation
	}: Props = $props();

	// Chat state
	let messages = $state<
		Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>
	>([]);
	let inputValue = $state('');
	let isStreaming = $state(false);
	let currentRunId = $state<string | null>(null);
	let _eventSource = $state<EventSource | null>(null);
	let chatContainer: HTMLDivElement;

	// System info
	let llmProvider = $state<'anthropic' | 'unavailable'>('unavailable');
	let isCheckingLLM = $state(true);

	// Check LLM availability on mount
	onMount(async () => {
		if (!browser) return;

		try {
			const res = await fetch('/api/agent/status');
			if (res.ok) {
				const data = await res.json();
				llmProvider = data.provider;
			}
		} catch {
			llmProvider = 'unavailable';
		} finally {
			isCheckingLLM = false;
		}

		// Add welcome message
		messages.push({
			role: 'system',
			content:
				llmProvider === 'anthropic'
					? 'Argos Agent online (Claude Sonnet 4.5)'
					: 'Agent unavailable. Set ANTHROPIC_API_KEY environment variable.',
			timestamp: new Date().toISOString()
		});
	});

	// Auto-send device context when operator clicks a device on the map
	$effect(() => {
		const event = $lastInteractionEvent;
		if (!event || isStreaming || llmProvider === 'unavailable') return;

		if (event.type === 'device_selected' && event.data.mac) {
			const deviceData = event.data;
			// Build contextual message that embeds device data
			const contextMessage =
				`[OPERATOR SELECTED DEVICE]\n` +
				`SSID: ${deviceData.ssid}\n` +
				`MAC: ${deviceData.mac}\n` +
				`RSSI: ${deviceData.rssi} dBm\n` +
				`Type: ${deviceData.type}\n` +
				`Manufacturer: ${deviceData.manufacturer}\n` +
				`Channel: ${deviceData.channel}\n` +
				`Frequency: ${deviceData.frequency} MHz\n` +
				`Packets: ${deviceData.packets}\n\n` +
				`Provide tactical analysis of this device.`;

			// Auto-send to agent
			sendMessageWithContent(contextMessage);

			// Clear the event to prevent re-triggering
			lastInteractionEvent.set(null);
		}
	});

	// Generate UUID (works in both secure and non-secure contexts)
	function generateUUID(): string {
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		// Fallback UUID v4 generator for non-secure contexts
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	// Send message with specific content (used by auto-query and manual input)
	async function sendMessageWithContent(content: string) {
		if (isStreaming) return;

		const userMessage = content;

		// Add user message
		messages.push({
			role: 'user',
			content: userMessage,
			timestamp: new Date().toISOString()
		});

		// Start streaming response
		isStreaming = true;
		currentRunId = generateUUID();

		// Create placeholder for assistant response
		const assistantMessageIndex = messages.length;
		messages.push({
			role: 'assistant',
			content: '',
			timestamp: new Date().toISOString()
		});

		try {
			// Get current agent context from store (AG-UI shared state)
			const currentContext = get(agentContext);

			// Build conversation history for context (last 10 messages)
			const conversationHistory = messages
				.filter((m) => m.role !== 'system')
				.slice(-10)
				.map((m) => ({ role: m.role, content: m.content }));

			const response = await fetch('/api/agent/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: userMessage,
					messages: conversationHistory,
					runId: currentRunId,
					context: currentContext
				})
			});

			if (!response.ok) throw new Error('Agent stream failed');

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) throw new Error('No response body');

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const event = JSON.parse(line.slice(6));

							if (event.type === 'TextMessageContent') {
								// Append delta to assistant message
								messages[assistantMessageIndex].content += event.delta;
								scrollToBottom();
							} else if (event.type === 'RunError') {
								messages[assistantMessageIndex].content +=
									`\n\n[Error: ${event.message}]`;
							}
						} catch {
							// Skip invalid JSON
						}
					}
				}
			}
		} catch (error) {
			messages[assistantMessageIndex].content =
				`Error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			isStreaming = false;
			currentRunId = null;
		}
	}

	// Send message from input (wrapper for sendMessageWithContent)
	async function sendMessage() {
		if (!inputValue.trim() || isStreaming) return;
		const userMessage = inputValue.trim();
		inputValue = '';
		await sendMessageWithContent(userMessage);
	}

	function scrollToBottom() {
		if (chatContainer) {
			setTimeout(() => {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 0);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function clearChat() {
		messages = [
			{
				role: 'system',
				content:
					llmProvider === 'anthropic'
						? 'Chat cleared. Argos Agent ready.'
						: 'Chat cleared. Argos Agent ready (offline mode).',
				timestamp: new Date().toISOString()
			}
		];
	}
</script>

<div class="agent-chat-panel">
	<!-- Chat toolbar -->
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
			<button class="toolbar-btn" title="Clear chat" onclick={clearChat}>
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

	<!-- Messages container -->
	<div class="chat-messages" bind:this={chatContainer}>
		{#each messages as message}
			<div
				class="message"
				class:user={message.role === 'user'}
				class:assistant={message.role === 'assistant'}
				class:system={message.role === 'system'}
			>
				<div class="message-header">
					<span class="message-role">
						{message.role === 'user'
							? 'OPERATOR'
							: message.role === 'assistant'
								? 'AGENT'
								: 'SYSTEM'}
					</span>
					<span class="message-timestamp">
						{new Date(message.timestamp).toLocaleTimeString()}
					</span>
				</div>
				<div class="message-content">
					{message.content}
				</div>
			</div>
		{/each}

		{#if isStreaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1].content}
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
			bind:value={inputValue}
			onkeydown={handleKeydown}
			placeholder={llmProvider === 'unavailable'
				? 'Agent unavailable. Install Ollama or configure ANTHROPIC_API_KEY.'
				: 'Type a message (Enter to send, Shift+Enter for new line)...'}
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
		background: #1e1e1e;
		color: #cccccc;
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
		font-size: 13px;
	}

	/* Toolbar */
	.chat-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: #252526;
		border-bottom: 1px solid #3c3c3c;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.agent-icon {
		color: #00d4ff;
	}

	.toolbar-title {
		color: #cccccc;
		font-weight: 500;
	}

	.llm-badge {
		padding: 2px 8px;
		border-radius: 3px;
		background: #3c3c3c;
		color: #888;
		font-size: 11px;
		text-transform: uppercase;
	}

	.llm-badge.online {
		background: #0e4429;
		color: #3fb950;
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
		color: #cccccc;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.1s;
	}

	.toolbar-btn:hover {
		background: #2a2d2e;
	}

	/* Messages */
	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 8px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

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
		color: #4ec9b0;
	}

	.message.assistant .message-role {
		color: #dcdcaa;
	}

	.message.system .message-role {
		color: #569cd6;
	}

	.message-timestamp {
		font-size: 10px;
		color: #6a737d;
	}

	.message-content {
		padding: 8px 12px;
		border-radius: 4px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message.user .message-content {
		background: #1a3a52;
		border-left: 3px solid #4ec9b0;
	}

	.message.assistant .message-content {
		background: #2d2d2d;
		border-left: 3px solid #dcdcaa;
	}

	.message.system .message-content {
		background: #1f2937;
		border-left: 3px solid #569cd6;
		font-size: 12px;
		color: #888;
	}

	/* Typing indicator */
	.typing-indicator {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #888;
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

	/* Input area */
	.chat-input-area {
		display: flex;
		gap: 8px;
		padding: 8px 12px;
		background: #252526;
		border-top: 1px solid #3c3c3c;
	}

	.chat-input {
		flex: 1;
		background: #1e1e1e;
		border: 1px solid #3c3c3c;
		border-radius: 4px;
		color: #cccccc;
		padding: 8px 12px;
		font-family: inherit;
		font-size: 13px;
		resize: none;
		outline: none;
	}

	.chat-input:focus {
		border-color: #007acc;
	}

	.chat-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: auto;
		background: #0e639c;
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		transition: background 0.1s;
	}

	.send-btn:hover:not(:disabled) {
		background: #1177bb;
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

	/* Scrollbar styling */
	.chat-messages::-webkit-scrollbar {
		width: 10px;
	}

	.chat-messages::-webkit-scrollbar-track {
		background: #1e1e1e;
	}

	.chat-messages::-webkit-scrollbar-thumb {
		background: #424242;
		border-radius: 5px;
	}

	.chat-messages::-webkit-scrollbar-thumb:hover {
		background: #4e4e4e;
	}
</style>
