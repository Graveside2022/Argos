/**
 * Agent chat logic module — Svelte 5 reactive state and actions
 * for the AgentChatPanel component.
 *
 * Manages message state, streaming, LLM status, and device interaction events.
 */
import { get } from 'svelte/store';

import { browser } from '$app/environment';
import { agentContext, lastInteractionEvent } from '$lib/stores/dashboard/agent-context-store';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: string;
}

// ============================================================================
// Reactive State
// ============================================================================

let messages = $state<ChatMessage[]>([]);
let inputValue = $state('');
let isStreaming = $state(false);
let currentRunId = $state<string | null>(null);
let llmProvider = $state<'anthropic' | 'unavailable'>('unavailable');
let isCheckingLLM = $state(true);
let chatContainer = $state<HTMLDivElement | undefined>(undefined);

// ============================================================================
// State Accessors (read-only exports for the template)
// ============================================================================

export function getMessages(): ChatMessage[] {
	return messages;
}

export function getInputValue(): string {
	return inputValue;
}

export function setInputValue(v: string): void {
	inputValue = v;
}

export function getIsStreaming(): boolean {
	return isStreaming;
}

export function getLlmProvider(): 'anthropic' | 'unavailable' {
	return llmProvider;
}

export function getIsCheckingLLM(): boolean {
	return isCheckingLLM;
}

export function setChatContainer(el: HTMLDivElement): void {
	chatContainer = el;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Generate UUID (works in both secure and non-secure contexts) */
function generateUUID(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function scrollToBottom(): void {
	if (chatContainer) {
		const el = chatContainer;
		setTimeout(() => {
			el.scrollTop = el.scrollHeight;
		}, 0);
	}
}

// ============================================================================
// Actions
// ============================================================================

/** Check LLM availability and add welcome message */
export async function initializeChat(): Promise<void> {
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

	messages.push({
		role: 'system',
		content:
			llmProvider === 'anthropic'
				? 'Argos Agent online (Claude Sonnet 4.5)'
				: 'Agent unavailable. Set ANTHROPIC_API_KEY environment variable.',
		timestamp: new Date().toISOString()
	});
}

/** Send message with specific content (used by auto-query and manual input) */
export async function sendMessageWithContent(content: string): Promise<void> {
	if (isStreaming) return;

	messages.push({
		role: 'user',
		content,
		timestamp: new Date().toISOString()
	});

	isStreaming = true;
	currentRunId = generateUUID();

	const assistantMessageIndex = messages.length;
	messages.push({
		role: 'assistant',
		content: '',
		timestamp: new Date().toISOString()
	});

	try {
		const currentContext = get(agentContext);
		const conversationHistory = messages
			.filter((m) => m.role !== 'system')
			.slice(-10)
			.map((m) => ({ role: m.role, content: m.content }));

		const response = await fetch('/api/agent/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: content,
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

/** Send message from manual input */
export async function sendMessage(): Promise<void> {
	if (!inputValue.trim() || isStreaming) return;
	const userMessage = inputValue.trim();
	inputValue = '';
	await sendMessageWithContent(userMessage);
}

/** Handle keyboard events on the input textarea */
export function handleKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
}

/** Clear chat and reset with a system message */
export function clearChat(): void {
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

/** Handle device-selected interaction events (called from $effect) */
export function handleInteractionEvent(
	event: { type: string; data: Record<string, unknown> } | null
): void {
	if (!event || isStreaming || llmProvider === 'unavailable') return;

	if (event.type === 'device_selected' && event.data.mac) {
		const d = event.data;
		const contextMessage =
			`[OPERATOR SELECTED DEVICE]\n` +
			`SSID: ${d.ssid}\n` +
			`MAC: ${d.mac}\n` +
			`RSSI: ${d.rssi} dBm\n` +
			`Type: ${d.type}\n` +
			`Manufacturer: ${d.manufacturer}\n` +
			`Channel: ${d.channel}\n` +
			`Frequency: ${d.frequency} MHz\n` +
			`Packets: ${d.packets}\n\n` +
			`Provide tactical analysis of this device.`;

		sendMessageWithContent(contextMessage);
		lastInteractionEvent.set(null);
	}
}
