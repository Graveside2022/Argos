/**
 * AG-UI Event Stream Endpoint
 * Streams agent events (text, tool calls, state updates) to frontend via SSE
 */

import type { RequestHandler } from './$types';
import { getSystemPrompt } from '$lib/server/agent/tools';

export const POST: RequestHandler = async ({ request }) => {
	const {
		message,
		messages: conversationHistory,
		threadId,
		runId,
		context
	} = await request.json();

	// Build system prompt with full UI context (AG-UI shared state)
	const systemPrompt = getSystemPrompt(context);

	// Build message array: system prompt + conversation history + current message
	const ollamaMessages: Array<{ role: string; content: string }> = [
		{ role: 'system', content: systemPrompt }
	];

	// Add conversation history if provided (for multi-turn memory)
	if (conversationHistory && Array.isArray(conversationHistory)) {
		// Skip the last message since we add it explicitly below
		for (const msg of conversationHistory.slice(0, -1)) {
			ollamaMessages.push({ role: msg.role, content: msg.content });
		}
	}

	// Add the current user message
	ollamaMessages.push({ role: 'user', content: message });

	// WORKAROUND: Fetch Ollama response BEFORE starting SSE stream
	// This avoids async deadlock in SSE context
	let ollamaResponse: string | undefined;
	try {
		console.log('[Agent API] Fetching from Ollama with', ollamaMessages.length, 'messages');
		console.log('[Agent API] System prompt length:', ollamaMessages[0]?.content?.length);
		const resp = await fetch('http://localhost:11434/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'llama3.2:1b',
				messages: ollamaMessages,
				stream: false,
				options: {
					num_ctx: 2048,
					num_predict: 64,
					temperature: 0.7
				}
			}),
			signal: AbortSignal.timeout(120000)
		});
		console.log('[Agent API] Ollama responded with status:', resp.status);
		const data = await resp.json();
		ollamaResponse = data.message?.content;
		console.log('[Agent API] Got response from Ollama, length:', ollamaResponse?.length);
	} catch (error) {
		console.error('[Agent API] Ollama fetch error:', error);
	}

	// Create SSE stream
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			// Helper to send SSE event
			const sendEvent = (event: Record<string, unknown>) => {
				const data = `data: ${JSON.stringify(event)}\n\n`;
				controller.enqueue(encoder.encode(data));
			};

			try {
				// Start agent run
				sendEvent({
					type: 'RunStarted',
					threadId: threadId || 'default',
					runId: runId || crypto.randomUUID(),
					timestamp: new Date().toISOString()
				});

				sendEvent({
					type: 'TextMessageStart',
					messageId: 'assistant-1',
					role: 'assistant',
					timestamp: new Date().toISOString()
				});

				// Send pre-fetched response
				if (ollamaResponse) {
					sendEvent({
						type: 'TextMessageContent',
						messageId: 'assistant-1',
						delta: ollamaResponse
					});
				} else {
					sendEvent({
						type: 'TextMessageContent',
						messageId: 'assistant-1',
						delta: 'Error: Could not fetch response from Ollama'
					});
				}

				sendEvent({
					type: 'TextMessageEnd',
					messageId: 'assistant-1',
					timestamp: new Date().toISOString()
				});

				sendEvent({
					type: 'RunFinished',
					threadId: threadId || 'default',
					runId: runId || crypto.randomUUID(),
					timestamp: new Date().toISOString()
				});

				// Close stream
				controller.close();
			} catch (error) {
				sendEvent({
					type: 'RunError',
					message: error instanceof Error ? error.message : String(error),
					code: 'AGENT_ERROR',
					timestamp: new Date().toISOString()
				});
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
