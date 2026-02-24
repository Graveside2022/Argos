/**
 * Argos Agent Runtime with Anthropic Claude Integration
 * Full integration with Argos UI state and tactical data
 * Dynamically loads tools from Tool Execution Framework
 */

import { env } from '$lib/server/env';
import { logger } from '$lib/utils/logger';

import { getAllTools, getSystemPrompt } from './tools';

interface AgentMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface AgentContext {
	selectedDevice?: string;
	selectedDeviceDetails?: {
		ssid: string;
		type: string;
		manufacturer: string;
		signalDbm: number | null;
		channel: string;
		frequency: number;
		encryption: string;
		packets: number;
	};
	mapBounds?: { north: number; south: number; east: number; west: number };
	activeSignals?: number;
	userLocation?: { lat: number; lon: number };
	kismetStatus?: { connected: boolean; status: string };
	hackrfStatus?: string;
	currentWorkflow?: string;
	workflowStep?: number;
	workflowGoal?: string;
}

interface AgentRunInput {
	messages: AgentMessage[];
	threadId?: string;
	runId?: string;
	context?: AgentContext;
}

type AgentEvent = Record<string, unknown>;

/**
 * Execute an MCP tool by calling the Argos API
 */
async function _executeTool(
	toolName: string,
	parameters: Record<string, unknown>
): Promise<unknown> {
	try {
		const response = await fetch('/api/agent/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tool_name: toolName,
				parameters
			})
		});

		if (!response.ok) {
			throw new Error(`Tool execution failed: ${response.statusText}`);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error || 'Tool execution failed');
		}

		return result.data;
	} catch (error) {
		logger.error('[Agent] Tool execution error', { toolName, error: String(error) });
		throw error;
	}
}

/**
 * Check if Anthropic API is available (internet connectivity + API key)
 */
async function isAnthropicAvailable(): Promise<boolean> {
	if (!env.ANTHROPIC_API_KEY) {
		return false;
	}

	try {
		// Quick connectivity check
		const response = await fetch('https://api.anthropic.com', {
			method: 'HEAD',
			signal: AbortSignal.timeout(2000) // 2 second timeout
		});
		return response.ok || response.status === 404; // 404 is ok, means API is reachable
	} catch {
		return false;
	}
}

/** Build request body for Anthropic Messages API */
function buildAnthropicRequest(
	messages: AgentMessage[],
	tools: ReturnType<typeof getAllTools>,
	systemPrompt: string
): string {
	return JSON.stringify({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4096,
		system: systemPrompt,
		messages: messages.map((m) => ({ role: m.role, content: m.content })),
		tools,
		stream: true
	});
}

/** Map a text delta event */
function mapTextDelta(event: Record<string, unknown>): AgentEvent | null {
	const delta = event.delta as Record<string, unknown> | undefined;
	if (!delta?.text) return null;
	return { type: 'TextMessageContent', messageId: 'assistant-1', delta: delta.text as string };
}

/** Map a tool-use start event */
function mapToolUseStart(event: Record<string, unknown>): AgentEvent | null {
	const block = event.content_block as Record<string, unknown> | undefined;
	if (block?.type !== 'tool_use') return null;
	return { type: 'ToolUseStart', toolName: block.name as string, toolCallId: block.id as string };
}

/** Map a tool parameter (input_json_delta) event */
function mapInputJsonDelta(event: Record<string, unknown>): AgentEvent | null {
	const delta = event.delta as Record<string, unknown> | undefined;
	if (delta?.type !== 'input_json_delta') return null;
	return { type: 'ToolParameterDelta', delta: delta.partial_json as string };
}

/** Map a content block stop event */
function mapBlockStop(event: Record<string, unknown>): AgentEvent | null {
	if (event.index === undefined) return null;
	return { type: 'ToolUseComplete' };
}

/** SSE event type → mapper lookup */
const streamEventMappers: Record<string, (event: Record<string, unknown>) => AgentEvent | null> = {
	content_block_delta: (e) => mapTextDelta(e) ?? mapInputJsonDelta(e),
	content_block_start: mapToolUseStart,
	content_block_stop: mapBlockStop
};

/** Map an Anthropic SSE event to an AgentEvent, or null if not relevant */
function mapStreamEvent(event: Record<string, unknown>): AgentEvent | null {
	const mapper = streamEventMappers[event.type as string];
	return mapper ? mapper(event) : null;
}

/** Try to parse a single SSE data payload into an AgentEvent */
function parseSsePayload(data: string): AgentEvent | null {
	try {
		return mapStreamEvent(JSON.parse(data) as Record<string, unknown>);
	} catch {
		return null;
	}
}

/** Extract the SSE data payload from a line, or null if not a data line */
function extractSseData(line: string): string | null {
	if (!line.startsWith('data: ')) return null;
	const data = line.slice(6);
	return data === '[DONE]' ? null : data;
}

/** Parse SSE data lines from a chunk of text, returning parsed events and remaining buffer */
function parseSseLines(buffer: string): { events: AgentEvent[]; remaining: string } {
	const lines = buffer.split('\n');
	const remaining = lines.pop() || '';
	const events: AgentEvent[] = [];
	for (const line of lines) {
		const data = extractSseData(line);
		if (!data) continue;
		const mapped = parseSsePayload(data);
		if (mapped) events.push(mapped);
	}
	return { events, remaining };
}

/**
 * Process message with Anthropic Claude (with tool support)
 */
/** Build Anthropic API request headers */
function buildAnthropicHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		'x-api-key': env.ANTHROPIC_API_KEY ?? '',
		'anthropic-version': '2023-06-01'
	};
}

/** Open a streaming reader to the Anthropic Messages API */
async function openAnthropicStream(
	messages: AgentMessage[],
	tools: ReturnType<typeof getAllTools>,
	context?: AgentContext
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: buildAnthropicHeaders(),
		body: buildAnthropicRequest(messages, tools, getSystemPrompt(context))
	});

	if (!response.ok) throw new Error(`Anthropic API error: ${response.statusText}`);
	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');
	return reader;
}

/**
 * Process message with Anthropic Claude (with tool support)
 */
async function* processWithAnthropic(
	messages: AgentMessage[],
	tools: ReturnType<typeof getAllTools>,
	context?: AgentContext
): AsyncGenerator<AgentEvent> {
	const reader = await openAnthropicStream(messages, tools, context);
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const { events, remaining } = parseSseLines(buffer);
		buffer = remaining;
		for (const event of events) yield event;
	}
}

/** Create a run lifecycle event */
function makeRunEvent(type: string, threadId: string): AgentEvent {
	return { type, threadId, runId: crypto.randomUUID(), timestamp: new Date().toISOString() };
}

/** Create an error event from an unknown error */
function makeErrorEvent(error: unknown): AgentEvent {
	return {
		type: 'RunError',
		message: error instanceof Error ? error.message : String(error),
		code: 'PROCESSING_ERROR',
		timestamp: new Date().toISOString()
	};
}

/**
 * Create Agent instance with MCP tools and Anthropic Claude
 */
export async function createAgent() {
	const hasAnthropic = await isAnthropicAvailable();
	if (!hasAnthropic) {
		throw new Error(
			'Anthropic Claude API not available. Set ANTHROPIC_API_KEY environment variable.'
		);
	}

	return {
		async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
			const { messages, context } = input;
			const thread = input.threadId || 'default';

			yield makeRunEvent('RunStarted', thread);
			yield {
				type: 'TextMessageStart',
				messageId: 'assistant-1',
				role: 'assistant',
				timestamp: new Date().toISOString()
			};

			try {
				for await (const event of processWithAnthropic(messages, getAllTools(), context)) {
					yield event;
				}
				yield {
					type: 'TextMessageEnd',
					messageId: 'assistant-1',
					timestamp: new Date().toISOString()
				};
				yield makeRunEvent('RunFinished', thread);
			} catch (error) {
				yield makeErrorEvent(error);
			}
		},

		// Safe: Provider literal narrowed to const for Anthropic SDK provider type
		provider: 'anthropic' as const
	};
}
