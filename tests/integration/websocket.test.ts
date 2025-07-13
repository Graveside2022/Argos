import { describe, it, expect, beforeEach as _beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { testUtils } from '../helpers/setup';

const WS_URL = process.env.WS_URL || 'ws://localhost:8093';

describe('WebSocket Connection Tests', () => {
	let ws: WebSocket | null = null;

	afterEach(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.close();
		}
	});

	describe('Native WebSocket Tests', () => {
		it('should establish WebSocket connection', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);
			expect(ws.readyState).toBe(WebSocket.OPEN);
		});

		it('should receive spectrum data', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			const dataPromise = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					resolve(message);
				});
			});

			// Request spectrum data
			ws.send(JSON.stringify({ type: 'getSpectrum' }));

			const message = await dataPromise;
			expect(message).toHaveProperty('type');
			expect(message).toHaveProperty('data');
		});

		it('should handle ping/pong for keepalive', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			const pongPromise = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('pong', () => resolve(true));
			});

			ws.ping();
			const ponged = await pongPromise;
			expect(ponged).toBe(true);
		});

		it('should handle connection errors gracefully', async () => {
			try {
				await testUtils.waitForWebSocket('ws://localhost:99999', 1000);
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeTruthy();
			}
		});

		it('should reconnect after disconnect', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			// Force disconnect
			ws.close();

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Reconnect
			ws = await testUtils.waitForWebSocket(WS_URL);
			expect(ws.readyState).toBe(WebSocket.OPEN);
		});
	});

	// Socket.IO tests removed - socket.io-client not installed
	// Focus on native WebSocket functionality only

	describe('Message Flow Tests', () => {
		it('should handle request-response pattern', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			const requestId = Date.now().toString();
			const responsePromise = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('message', (data: unknown) => {
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
			ws = await testUtils.waitForWebSocket(WS_URL);

			const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
			const responsePromise = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('message', (data) => {
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
			ws = await testUtils.waitForWebSocket(WS_URL);

			let messageCount = 0;
			const startTime = Date.now();

			ws.on('message', () => {
				messageCount++;
			});

			// Send 100 messages rapidly
			for (let i = 0; i < 100; i++) {
				ws.send(JSON.stringify({ type: 'test', index: i }));
			}

			// Wait for messages to be processed
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const elapsed = Date.now() - startTime;
			const messagesPerSecond = (messageCount / elapsed) * 1000;

			expect(messageCount).toBeGreaterThan(0);
			expect(messagesPerSecond).toBeGreaterThan(10); // At least 10 messages per second
		});

		it('should handle concurrent connections', async () => {
			const connections = await Promise.all(
				Array(10)
					.fill(null)
					.map(() => testUtils.waitForWebSocket(WS_URL))
			);

			expect(connections.length).toBe(10);
			connections.forEach((conn) => {
				expect(conn.readyState).toBe(WebSocket.OPEN);
			});

			// Clean up
			connections.forEach((conn) => conn.close());
		});
	});

	describe('Error Recovery Tests', () => {
		it('should handle malformed messages', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			const errorPromise = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('message', (data: unknown) => {
					const message = JSON.parse(String(data)) as Record<string, unknown>;
					if (message.type === 'error') {
						resolve(message);
					}
				});
			});

			// Send malformed JSON
			ws.send('{ invalid json');

			const error = (await errorPromise) as Record<string, unknown>;
			expect(error).toHaveProperty('type', 'error');
			expect(error).toHaveProperty('message');
		});

		it('should maintain connection during errors', async () => {
			ws = await testUtils.waitForWebSocket(WS_URL);

			// Send invalid message
			ws.send('{ invalid json');

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Connection should still be open
			expect(ws.readyState).toBe(WebSocket.OPEN);

			// Should still be able to send valid messages
			const validResponse = new Promise((resolve) => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				ws!.on('message', (data: unknown) => {
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
