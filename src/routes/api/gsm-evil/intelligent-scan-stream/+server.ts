import { performIntelligentScan } from '$lib/server/services/gsm-evil/gsm-intelligent-scan-service';

import type { RequestHandler } from './$types';

/**
 * POST /api/gsm-evil/intelligent-scan-stream
 * Server-Sent Events (SSE) stream for intelligent GSM frequency scanning
 * Returns live progress updates and results as they arrive
 */
export const POST: RequestHandler = async ({ request: _request }) => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Consume the async generator from the service
				for await (const event of performIntelligentScan()) {
					// Encode events as SSE format
					if (event.type === 'update' && event.message) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ message: event.message })}\n\n`
							)
						);
					} else if (event.type === 'result' && event.result) {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ result: event.result })}\n\n`)
						);
					} else if (event.type === 'error') {
						if (event.message) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ message: event.message })}\n\n`
								)
							);
						}
						if (event.result) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ result: event.result })}\n\n`
								)
							);
						}
					}
				}
			} catch (error: unknown) {
				// Service threw an unhandled error
				// Safe: Catch block error cast to Error for scan failure message
				// Safe: Catch block error cast to Error for message extraction
				const errorMsg = `[ERROR] Scan service failed: ${(error as Error).message}`;
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ message: errorMsg })}\n\n`)
				);
			} finally {
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
