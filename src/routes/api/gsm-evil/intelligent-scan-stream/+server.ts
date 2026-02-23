import { errMsg } from '$lib/server/api/error-utils';
import { performIntelligentScan } from '$lib/server/services/gsm-evil/gsm-intelligent-scan-service';

import type { RequestHandler } from './$types';

const encoder = new TextEncoder();

function encodeSseData(payload: Record<string, unknown>): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

interface ScanEvent {
	type: string;
	message?: string;
	result?: unknown;
}

function enqueueIfPresent(
	controller: ReadableStreamDefaultController,
	key: string,
	value: unknown
): void {
	if (value) controller.enqueue(encodeSseData({ [key]: value }));
}

type EventEncoder = (event: ScanEvent, controller: ReadableStreamDefaultController) => void;

const eventEncoders: Record<string, EventEncoder> = {
	update: (event, controller) => enqueueIfPresent(controller, 'message', event.message),
	result: (event, controller) => enqueueIfPresent(controller, 'result', event.result),
	error: (event, controller) => {
		enqueueIfPresent(controller, 'message', event.message);
		enqueueIfPresent(controller, 'result', event.result);
	}
};

const noopEncoder: EventEncoder = () => {};

function encodeScanEvent(event: ScanEvent, controller: ReadableStreamDefaultController): void {
	(eventEncoders[event.type] || noopEncoder)(event, controller);
}

async function consumeScanStream(controller: ReadableStreamDefaultController): Promise<void> {
	try {
		for await (const event of performIntelligentScan()) {
			encodeScanEvent(event as ScanEvent, controller);
		}
	} catch (error: unknown) {
		const errorMsg = `[ERROR] Scan service failed: ${errMsg(error)}`;
		controller.enqueue(encodeSseData({ message: errorMsg }));
	} finally {
		controller.close();
	}
}

/**
 * POST /api/gsm-evil/intelligent-scan-stream
 * Server-Sent Events (SSE) stream for intelligent GSM frequency scanning
 * Returns live progress updates and results as they arrive
 */
export const POST: RequestHandler = async ({ request: _request }) => {
	const stream = new ReadableStream({
		start(controller) {
			void consumeScanStream(controller);
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
