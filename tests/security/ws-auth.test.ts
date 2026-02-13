/**
 * WebSocket Authentication Security Tests - Phase 2.2.6
 *
 * Validates Phase 2.1.6: WebSocket Authentication
 * Tests that unauthenticated WebSocket connections are rejected.
 *
 * Standards: OWASP A01:2021 (Broken Access Control), NIST SP 800-53 AC-3
 */

import { describe, expect,test } from 'vitest';
import { WebSocket } from 'ws';

import { isServerAvailable, restoreRealFetch } from '../helpers/server-check';

restoreRealFetch();

const BASE_URL = 'ws://localhost:5173';
const API_KEY = process.env.ARGOS_API_KEY || '';
const canRun = API_KEY.length >= 32 && (await isServerAvailable());

describe.runIf(canRun)('WebSocket Authentication Security', () => {
	describe('Unauthenticated Connection Attempts', () => {
		test('Connection without token is rejected', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws`);

				ws.on('open', () => {
					ws.close();
					reject(new Error('WebSocket connection should have been rejected'));
				});

				ws.on('close', (code) => {
					// Expected: connection closed by server during handshake or immediately after
					expect(code).not.toBe(1000); // 1000 = normal closure (would indicate success)
					resolve();
				});

				ws.on('error', (_error) => {
					// Connection error is acceptable (server rejected the connection)
					resolve();
				});

				// Timeout: if connection stays open, fail the test
				setTimeout(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
						reject(new Error('WebSocket connection should have been rejected'));
					} else {
						resolve();
					}
				}, 2000);
			});
		});

		test('Connection with invalid token is rejected', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws?token=invalid-token-12345`);

				ws.on('open', () => {
					ws.close();
					reject(new Error('WebSocket connection with invalid token should be rejected'));
				});

				ws.on('close', (code) => {
					expect(code).not.toBe(1000);
					resolve();
				});

				ws.on('error', () => {
					resolve();
				});

				setTimeout(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
						reject(new Error('WebSocket connection should have been rejected'));
					} else {
						resolve();
					}
				}, 2000);
			});
		});
	});

	describe('Authenticated Connection Attempts', () => {
		test('Connection with valid token in query param succeeds', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws?token=${API_KEY}`);

				ws.on('open', () => {
					// Success! Close the connection cleanly
					ws.close();
					resolve();
				});

				ws.on('close', (code) => {
					if (code === 1000) {
						// Normal closure after successful connection
						resolve();
					}
				});

				ws.on('error', (error) => {
					reject(
						new Error(`WebSocket connection with valid token failed: ${error.message}`)
					);
				});

				// Timeout: connection should establish within 2 seconds
				setTimeout(() => {
					if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
						ws.close();
						reject(new Error('WebSocket connection with valid token timed out'));
					}
				}, 2000);
			});
		});

		test('Connection with X-API-Key header succeeds', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws`, {
					headers: {
						'X-API-Key': API_KEY
					}
				});

				ws.on('open', () => {
					ws.close();
					resolve();
				});

				ws.on('close', (code) => {
					if (code === 1000) {
						resolve();
					}
				});

				ws.on('error', (error) => {
					reject(
						new Error(`WebSocket connection with header auth failed: ${error.message}`)
					);
				});

				setTimeout(() => {
					if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
						ws.close();
						reject(new Error('WebSocket connection with header auth timed out'));
					}
				}, 2000);
			});
		});
	});

	describe('Payload Size Limits (Phase 2.1.6)', () => {
		test('WebSocket has 256KB max payload limit', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws?token=${API_KEY}`);

				ws.on('open', () => {
					// Try to send a message larger than 256KB
					const largePayload = 'x'.repeat(300 * 1024); // 300KB
					ws.send(largePayload);

					// Server should close the connection due to payload size limit
					setTimeout(() => {
						if (ws.readyState === WebSocket.OPEN) {
							ws.close();
							reject(
								new Error(
									'WebSocket accepted oversized payload (should enforce 256KB limit)'
								)
							);
						} else {
							resolve();
						}
					}, 1000);
				});

				ws.on('close', (_code) => {
					// Connection closed (expected for oversized payload)
					resolve();
				});

				ws.on('error', () => {
					// Error on send (acceptable)
					resolve();
				});

				setTimeout(() => {
					ws.close();
					reject(new Error('WebSocket payload size test timed out'));
				}, 3000);
			});
		});
	});

	describe('Security Edge Cases', () => {
		test('Empty token query param is rejected', async () => {
			return new Promise<void>((resolve, reject) => {
				const ws = new WebSocket(`${BASE_URL}/ws?token=`);

				ws.on('open', () => {
					ws.close();
					reject(new Error('WebSocket with empty token should be rejected'));
				});

				ws.on('close', () => resolve());
				ws.on('error', () => resolve());

				setTimeout(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.close();
						reject(new Error('WebSocket with empty token should be rejected'));
					} else {
						resolve();
					}
				}, 2000);
			});
		});

		test('Token in URL fragment is ignored (fragments not sent to server)', async () => {
			return new Promise<void>((resolve, reject) => {
				// URL fragments (#...) are client-side only, never sent to server
				const ws = new WebSocket(`${BASE_URL}/ws#token=${API_KEY}`);

				ws.on('open', () => {
					ws.close();
					reject(new Error('WebSocket with fragment token should be rejected'));
				});

				ws.on('close', () => resolve());
				ws.on('error', () => resolve());

				setTimeout(() => {
					if (ws.readyState !== WebSocket.OPEN) {
						resolve();
					} else {
						ws.close();
						reject(new Error('WebSocket with fragment token should be rejected'));
					}
				}, 2000);
			});
		});
	});
});
