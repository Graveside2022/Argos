/**
 * Argos Agent Runtime with Anthropic Claude Integration
 * Full integration with Argos UI state and tactical data
 * Dynamically loads tools from Tool Execution Framework
 */

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
		console.error(`Tool execution error (${toolName}):`, error);
		throw error;
	}
}

/**
 * Check if Anthropic API is available (internet connectivity + API key)
 */
async function isAnthropicAvailable(): Promise<boolean> {
	if (!process.env.ANTHROPIC_API_KEY) {
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

/**
 * Process message with Anthropic Claude (with tool support)
 */
async function* processWithAnthropic(
	messages: AgentMessage[],
	tools: ReturnType<typeof getAllTools>,
	context?: AgentContext
): AsyncGenerator<AgentEvent> {
	const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

	// Inject system prompt with context
	const systemPrompt = getSystemPrompt(context);
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': ANTHROPIC_API_KEY || '',
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 4096,
			system: systemPrompt, // Anthropic wants system prompt separate
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			tools,
			stream: true
		})
	});

	if (!response.ok) {
		throw new Error(`Anthropic API error: ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) throw new Error('No response body');

	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (line.startsWith('data: ')) {
				const data = line.slice(6);
				if (data === '[DONE]') continue;

				try {
					const event = JSON.parse(data);

					// Handle text content
					if (event.type === 'content_block_delta' && event.delta?.text) {
						yield {
							type: 'TextMessageContent',
							messageId: 'assistant-1',
							delta: event.delta.text
						};
					}

					// Handle tool use requests
					if (
						event.type === 'content_block_start' &&
						event.content_block?.type === 'tool_use'
					) {
						yield {
							type: 'ToolUseStart',
							toolName: event.content_block.name,
							toolCallId: event.content_block.id
						};
					}

					if (
						event.type === 'content_block_delta' &&
						event.delta?.type === 'input_json_delta'
					) {
						// Tool parameters being streamed
						yield {
							type: 'ToolParameterDelta',
							delta: event.delta.partial_json
						};
					}

					if (event.type === 'content_block_stop' && event.index !== undefined) {
						// Tool use complete - execute it
						// Note: In a real implementation, we'd need to accumulate the tool parameters
						// and execute the tool here, then continue the conversation with the result
						yield {
							type: 'ToolUseComplete'
						};
					}
				} catch {
					// Skip invalid JSON
				}
			}
		}
	}
}

/**
 * Create Agent instance with MCP tools and Anthropic Claude
 */
export async function createAgent() {
	// Check Anthropic availability
	const hasAnthropic = await isAnthropicAvailable();

	if (!hasAnthropic) {
		throw new Error(
			'Anthropic Claude API not available. Set ANTHROPIC_API_KEY environment variable.'
		);
	}

	return {
		async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
			const { messages, threadId, runId, context } = input;

			// Emit start event
			yield {
				type: 'RunStarted',
				threadId: threadId || 'default',
				runId: runId || crypto.randomUUID(),
				timestamp: new Date().toISOString()
			};

			// Emit message start
			yield {
				type: 'TextMessageStart',
				messageId: 'assistant-1',
				role: 'assistant',
				timestamp: new Date().toISOString()
			};

			try {
				// Get dynamic tool list from framework
				const availableTools = getAllTools();

				// Stream Anthropic Claude responses
				for await (const event of processWithAnthropic(messages, availableTools, context)) {
					yield event;
				}

				// Emit message end
				yield {
					type: 'TextMessageEnd',
					messageId: 'assistant-1',
					timestamp: new Date().toISOString()
				};

				// Emit run finished
				yield {
					type: 'RunFinished',
					threadId: threadId || 'default',
					runId: runId || crypto.randomUUID(),
					timestamp: new Date().toISOString()
				};
			} catch (error) {
				yield {
					type: 'RunError',
					message: error instanceof Error ? error.message : String(error),
					code: 'PROCESSING_ERROR',
					timestamp: new Date().toISOString()
				};
			}
		},

		// Expose provider information
		// Safe: Provider literal narrowed to const for Anthropic SDK provider type
		provider: 'anthropic' as const
	};
}
