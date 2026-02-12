/**
 * AG-UI Event Stream Endpoint
 * Streams agent events (text, tool calls, state updates) to frontend via SSE
 * Uses Anthropic Claude API
 */

import { createAgent } from '$lib/server/agent/runtime';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const {
		message,
		messages: conversationHistory,
		threadId,
		runId,
		context
	} = await request.json();

	// Build message array for agent
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

	// Add conversation history if provided
	if (conversationHistory && Array.isArray(conversationHistory)) {
		for (const msg of conversationHistory) {
			if (msg.role === 'user' || msg.role === 'assistant') {
				messages.push({ role: msg.role, content: msg.content });
			}
		}
	}

	// Add the current user message (if not already in history)
	if (!messages.length || messages[messages.length - 1].content !== message) {
		messages.push({ role: 'user', content: message });
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
				// Create agent with Anthropic
				const agent = await createAgent();

				// Stream agent run
				for await (const event of agent.run({
					messages,
					threadId,
					runId,
					context
				})) {
					sendEvent(event);
				}

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
