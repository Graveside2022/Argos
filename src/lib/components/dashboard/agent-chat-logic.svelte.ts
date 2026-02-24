/**
 * Agent chat logic module — Svelte 5 reactive state and actions
 * for the AgentChatPanel component.
 *
 * Manages message state, streaming, LLM status, and device interaction events.
 */
import { get } from 'svelte/store';

import { browser } from '$app/environment';
import { agentContext, lastInteractionEvent } from '$lib/stores/dashboard/agent-context-store';
import { fetchJSON } from '$lib/utils/fetch-json';

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

	const data = await fetchJSON<{ provider: string }>('/api/agent/status');
	llmProvider = data?.provider === 'anthropic' ? 'anthropic' : 'unavailable';
	isCheckingLLM = false;

	messages.push({
		role: 'system',
		content:
			llmProvider === 'anthropic'
				? 'Argos Agent online (Claude Sonnet 4.5)'
				: 'Agent unavailable. Set ANTHROPIC_API_KEY environment variable.',
		timestamp: new Date().toISOString()
	});
}

/** Build recent conversation history for the agent */
function buildConversationHistory(): { role: string; content: string }[] {
	return messages
		.filter((m) => m.role !== 'system')
		.slice(-10)
		.map((m) => ({ role: m.role, content: m.content }));
}

/** Post a message to the agent stream endpoint */
async function postToAgentStream(content: string): Promise<Response> {
	const currentContext = get(agentContext);
	const response = await fetch('/api/agent/stream', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			message: content,
			messages: buildConversationHistory(),
			runId: currentRunId,
			context: currentContext
		})
	});
	if (!response.ok) throw new Error('Agent stream failed');
	return response;
}

/** Process a single SSE data line and update the assistant message */
function processSSELine(line: string, messageIndex: number): void {
	if (!line.startsWith('data: ')) return;
	try {
		const event = JSON.parse(line.slice(6));
		if (event.type === 'TextMessageContent') {
			messages[messageIndex].content += event.delta;
			scrollToBottom();
		} else if (event.type === 'RunError') {
			messages[messageIndex].content += `\n\n[Error: ${event.message}]`;
		}
	} catch {
		// Skip invalid JSON
	}
}

/** Get a ReadableStreamDefaultReader from a Response, throwing on null body */
function getResponseReader(response: Response): ReadableStreamDefaultReader<Uint8Array> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');
	return reader;
}

/** Read an SSE response stream and update the assistant message */
async function consumeStream(response: Response, messageIndex: number): Promise<void> {
	const reader = getResponseReader(response);
	const decoder = new TextDecoder();

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const lines = decoder.decode(value).split('\n');
		for (const line of lines) processSSELine(line, messageIndex);
	}
}

/** Send message with specific content (used by auto-query and manual input) */
export async function sendMessageWithContent(content: string): Promise<void> {
	if (isStreaming) return;

	messages.push({ role: 'user', content, timestamp: new Date().toISOString() });
	isStreaming = true;
	currentRunId = generateUUID();

	const assistantIdx = messages.length;
	messages.push({ role: 'assistant', content: '', timestamp: new Date().toISOString() });

	try {
		const response = await postToAgentStream(content);
		await consumeStream(response, assistantIdx);
	} catch (error) {
		messages[assistantIdx].content =
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

/** Format a device-selected event into a tactical analysis prompt */
function formatDeviceQuery(d: Record<string, unknown>): string {
	return (
		`[OPERATOR SELECTED DEVICE]\n` +
		`SSID: ${d.ssid}\nMAC: ${d.mac}\nRSSI: ${d.rssi} dBm\n` +
		`Type: ${d.type}\nManufacturer: ${d.manufacturer}\n` +
		`Channel: ${d.channel}\nFrequency: ${d.frequency} MHz\n` +
		`Packets: ${d.packets}\n\nProvide tactical analysis of this device.`
	);
}

/** Whether the chat can accept a new auto-query */
function canAcceptAutoQuery(): boolean {
	return !isStreaming && llmProvider !== 'unavailable';
}

/** Handle device-selected interaction events (called from $effect) */
export function handleInteractionEvent(
	event: { type: string; data: Record<string, unknown> } | null
): void {
	if (!event || !canAcceptAutoQuery()) return;
	if (event.type !== 'device_selected' || !event.data.mac) return;

	sendMessageWithContent(formatDeviceQuery(event.data));
	lastInteractionEvent.set(null);
}
