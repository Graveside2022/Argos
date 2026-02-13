/**
 * WebSocket Connection Integration Tests
 *
 * Requires: Running WebSocket server at ws://localhost:8093
 * Skips gracefully when server is not available.
 */

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:8093';

// Check if WebSocket server is available
let canRun = false;
try {
	const ws = new WebSocket(WS_URL);
	canRun = await new Promise<boolean>((resolve) => {
		const timeout = setTimeout(() => {
			ws.close();
			resolve(false);
		}, 2000);
		ws.on('open', () => {
			clearTimeout(timeout);
			ws.close();
			resolve(true);
		});
		ws.on('error', () => {
			clearTimeout(timeout);
			resolve(false);
		});
	});
} catch {
	canRun = false;
}

function waitForWebSocket(url: string, timeout = 5000): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		const timer = setTimeout(() => {
			ws.close();
			reject(new Error(`WebSocket connection timed out after ${timeout}ms`));
		}, timeout);
		ws.on('open', () => {
			clearTimeout(timer);
			resolve(ws);
		});
		ws.on('error', (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

describe.runIf(canRun)('WebSocket Connection Tests', () => {
	let ws: WebSocket | null = null;

	afterEach(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.close();
		}
	});

	describe('Native WebSocket Tests', () => {
		it('should establish WebSocket connection', async () => {
			ws = await waitForWebSocket(WS_URL);
			expect(ws.readyState).toBe(WebSocket.OPEN);
		});

		it('should receive spectrum data', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			const dataPromise = new Promise((resolve) => {
				if (!ws) return;
				ws.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					resolve(message);
				});
			});

			ws.send(JSON.stringify({ type: 'getSpectrum' }));

			const message = await dataPromise;
			expect(message).toHaveProperty('type');
			expect(message).toHaveProperty('data');
		});

		it('should handle ping/pong for keepalive', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			const pongPromise = new Promise((resolve) => {
				if (!ws) return;
				ws.on('pong', () => resolve(true));
			});

			ws.ping();
			const ponged = await pongPromise;
			expect(ponged).toBe(true);
		});

		it('should handle connection errors gracefully', async () => {
			try {
				await waitForWebSocket('ws://localhost:99999', 1000);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeTruthy();
			}
		});

		it('should reconnect after disconnect', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			ws.close();
			await new Promise((resolve) => setTimeout(resolve, 100));

			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');
			expect(ws.readyState).toBe(WebSocket.OPEN);
		});
	});

	describe('Message Flow Tests', () => {
		it('should handle request-response pattern', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			const requestId = Date.now().toString();
			const responsePromise = new Promise((resolve) => {
				if (!ws) return;
				ws.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					if (message.requestId === requestId) {
						resolve(message);
					}
				});
			});

			ws.send(
				JSON.stringify({
					type: 'request',
					requestId,
					action: 'getStatus'
				})
			);

			const response = (await responsePromise) as Record<string, unknown>;
			expect(response).toHaveProperty('requestId', requestId);
			expect(response).toHaveProperty('status');
		});

		it('should handle binary data transfer', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
			const responsePromise = new Promise((resolve) => {
				if (!ws) return;
				ws.on('message', (data) => {
					if (data instanceof Buffer) {
						resolve(data);
					}
				});
			});

			ws.send(binaryData);

			const response = await responsePromise;
			expect(response).toBeInstanceOf(Buffer);
		});
	});

	describe('Performance and Load Tests', () => {
		it('should handle high-frequency messages', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			let messageCount = 0;
			const startTime = Date.now();

			ws.on('message', () => {
				messageCount++;
			});

			for (let i = 0; i < 100; i++) {
				ws.send(JSON.stringify({ type: 'test', index: i }));
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const elapsed = Date.now() - startTime;
			const messagesPerSecond = (messageCount / elapsed) * 1000;

			expect(messageCount).toBeGreaterThan(0);
			expect(messagesPerSecond).toBeGreaterThan(10);
		});

		it('should handle concurrent connections', async () => {
			const connections = await Promise.all(
				Array(10)
					.fill(null)
					.map(() => waitForWebSocket(WS_URL))
			);

			expect(connections.length).toBe(10);
			connections.forEach((conn) => {
				expect(conn.readyState).toBe(WebSocket.OPEN);
			});

			connections.forEach((conn) => conn.close());
		});
	});

	describe('Error Recovery Tests', () => {
		it('should handle malformed messages', async () => {
			ws = await waitForWebSocket(WS_URL);
			if (!ws) throw new Error('WebSocket not initialized');

			const errorPromise = new Promise((resolve) => {
				if (!ws) return;
				ws.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					if (message.type === 'error') {
						resolve(message);
					}
				});
			});

			ws.send('{ invalid json');

			const error = (await errorPromise) as Record<string, unknown>;
			expect(error).toHaveProperty('type', 'error');
			expect(error).toHaveProperty('message');
		});

		it('should maintain connection during errors', async () => {
			ws = await waitForWebSocket(WS_URL);

			ws.send('{ invalid json');
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(ws.readyState).toBe(WebSocket.OPEN);

			const capturedWs = ws;
			const validResponse = new Promise((resolve) => {
				capturedWs.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					if (message.type === 'pong') {
						resolve(true);
					}
				});
			});

			ws.send(JSON.stringify({ type: 'ping' }));

			const ponged = await validResponse;
			expect(ponged).toBe(true);
		});
	});
});
