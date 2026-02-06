/**
 * AG-UI Event Stream Endpoint
 * Streams agent events (text, tool calls, state updates) to frontend via SSE
 */

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { message, threadId, runId } = await request.json();

	// WORKAROUND: Fetch Ollama response BEFORE starting SSE stream
	// This avoids async deadlock in SSE context
	let ollamaResponse: string | undefined;
	try {
		const resp = await fetch('http://localhost:11434/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'llama3.2:1b',
				messages: [
					{
						role: 'user',
						content: message
					}
				],
				stream: false
			}),
			signal: AbortSignal.timeout(30000)
		});
		const data = await resp.json();
		ollamaResponse = data.message?.content;
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
