/**
 * Argos Agent Runtime with Hybrid LLM and Tool Execution Framework
 * Supports Anthropic Claude (online) with Ollama fallback (offline)
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
	mapBounds?: { north: number; south: number; east: number; west: number };
	activeSignals?: number;
	userLocation?: { lat: number; lon: number };
	kismetStatus?: string;
	hackrfStatus?: string;
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
 * Check if Ollama is available locally
 */
async function isOllamaAvailable(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:11434/api/tags', {
			signal: AbortSignal.timeout(1000)
		});
		return response.ok;
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
 * Fetch response from Ollama BEFORE starting generator
 * This avoids async deadlock in SSE stream context
 */
async function fetchOllamaResponse(
	messages: AgentMessage[],
	context?: AgentContext
): Promise<string> {
	const systemPrompt = getSystemPrompt(context);
	const messagesWithSystem = [{ role: 'system' as const, content: systemPrompt }, ...messages];

	const response = await fetch('http://localhost:11434/api/chat', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: 'llama3.2:1b',
			messages: messagesWithSystem.map((m) => ({ role: m.role, content: m.content })),
			stream: false
		}),
		signal: AbortSignal.timeout(30000)
	});

	if (!response.ok) {
		throw new Error(`Ollama API error: ${response.statusText}`);
	}

	const data = await response.json();
	return data.message?.content || '';
}

/**
 * Process message with Ollama (local fallback)
 * Generator yields pre-fetched response to avoid SSE deadlock
 */
async function* processWithOllama(
	messages: AgentMessage[],
	_tools: ReturnType<typeof getAllTools>,
	context?: AgentContext,
	prefetchedResponse?: string
): AsyncGenerator<AgentEvent> {
	// If response wasn't pre-fetched, this shouldn't happen, but handle it
	const content = prefetchedResponse || 'Error: Response not pre-fetched';

	yield {
		type: 'TextMessageContent',
		messageId: 'assistant-1',
		delta: content
	};
}

/**
 * Create Agent instance with MCP tools and hybrid LLM
 */
export async function createAgent() {
	// Check LLM availability
	const hasAnthropic = await isAnthropicAvailable();
	const hasOllama = await isOllamaAvailable();

	if (!hasAnthropic && !hasOllama) {
		throw new Error(
			'No LLM available. Install Ollama locally or set ANTHROPIC_API_KEY environment variable.'
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
				// For Ollama: Pre-fetch response OUTSIDE generator to avoid SSE deadlock
				let ollamaResponse: string | undefined;
				if (!hasAnthropic) {
					ollamaResponse = await fetchOllamaResponse(messages, context);
				}

				// Get dynamic tool list from framework
				const availableTools = getAllTools();

				// Choose LLM based on availability and pass context
				const processor = hasAnthropic
					? processWithAnthropic(messages, availableTools, context)
					: processWithOllama(messages, availableTools, context, ollamaResponse);

				// Stream LLM responses
				for await (const event of processor) {
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
		provider: hasAnthropic ? ('anthropic' as const) : ('ollama' as const)
	};
}
