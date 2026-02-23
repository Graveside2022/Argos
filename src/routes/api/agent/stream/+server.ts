/**
 * AG-UI Event Stream Endpoint
 * Streams agent events (text, tool calls, state updates) to frontend via SSE
 * Uses Anthropic Claude API
 */

import { createAgent } from '$lib/server/agent/runtime';

import type { RequestHandler } from './$types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Check if a message has a valid chat role. */
function isValidRole(role: string): role is 'user' | 'assistant' {
	return role === 'user' || role === 'assistant';
}

/** Extract valid chat messages from conversation history. */
function extractHistory(conversationHistory: unknown): ChatMessage[] {
	if (!Array.isArray(conversationHistory)) return [];
	return conversationHistory
		.filter((msg) => isValidRole(msg.role))
		.map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
}

/** Check if last message already contains the current user message. */
function needsCurrentMessage(messages: ChatMessage[], message: string): boolean {
	return !messages.length || messages[messages.length - 1].content !== message;
}

/** Build messages array from conversation history and current message. */
function buildMessages(conversationHistory: unknown, message: string): ChatMessage[] {
	const messages = extractHistory(conversationHistory);
	if (needsCurrentMessage(messages, message)) {
		messages.push({ role: 'user', content: message });
	}
	return messages;
}

/** Build error event for SSE stream. */
function buildErrorEvent(error: unknown): Record<string, unknown> {
	return {
		type: 'RunError',
		message: error instanceof Error ? error.message : String(error),
		code: 'AGENT_ERROR',
		timestamp: new Date().toISOString()
	};
}

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	Connection: 'keep-alive'
};

export const POST: RequestHandler = async ({ request }) => {
	const {
		message,
		messages: conversationHistory,
		threadId,
		runId,
		context
	} = await request.json();
	const messages = buildMessages(conversationHistory, message);

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (event: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};

			try {
				const agent = await createAgent();
				for await (const event of agent.run({ messages, threadId, runId, context })) {
					sendEvent(event);
				}
				controller.close();
			} catch (error) {
				sendEvent(buildErrorEvent(error));
				controller.close();
			}
		}
	});

	return new Response(stream, { headers: SSE_HEADERS });
};
