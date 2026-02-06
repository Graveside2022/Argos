/**
 * WebSocket Backend Adapter
 *
 * Executes tools by connecting to WebSocket services for real-time data
 */

import { WebSocket } from 'ws';
import type {
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionResult,
	ExecutionContext,
	WebSocketBackendConfig
} from '../types';

export class WebSocketAdapter implements ToolBackendAdapter {
	readonly type = 'websocket' as const;
	private initialized = false;
	private connections: Map<string, WebSocket> = new Map();

	async initialize(): Promise<void> {
		console.log('[WebSocketAdapter] Initializing WebSocket adapter...');
		this.initialized = true;
	}

	async execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		_context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();
		const config = tool.backendConfig as WebSocketBackendConfig;

		try {
			console.log(`[WebSocketAdapter] Connecting to ${config.url}`);

			// Create or get WebSocket connection
			const ws = await this.getConnection(config.url);

			// Send request
			const request =
				config.requestFormat === 'json'
					? JSON.stringify({ tool: tool.name, parameters })
					: `${tool.name}:${JSON.stringify(parameters)}`;

			// Wait for response
			const data = await this.sendAndWaitForResponse(ws, request, config.timeout || 30000);

			return {
				status: 'success',
				toolName: tool.name,
				data,
				duration: Date.now() - startTime,
				timestamp: Date.now(),
				backend: this.type
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			// Check for timeout
			if (error instanceof Error && error.message.includes('timeout')) {
				return {
					status: 'timeout',
					toolName: tool.name,
					error: 'WebSocket request timed out',
					errorDetails: error,
					duration,
					timestamp: Date.now(),
					backend: this.type
				};
			}

			return {
				status: 'error',
				toolName: tool.name,
				error: error instanceof Error ? error.message : String(error),
				errorDetails: error,
				duration,
				timestamp: Date.now(),
				backend: this.type
			};
		}
	}

	async healthCheck(): Promise<boolean> {
		if (!this.initialized) {
			return false;
		}

		// Check if any connections are open
		for (const ws of this.connections.values()) {
			if (ws.readyState === WebSocket.OPEN) {
				return true;
			}
		}

		return true; // Still healthy even if no connections
	}

	async cleanup(): Promise<void> {
		console.log('[WebSocketAdapter] Cleaning up WebSocket adapter...');

		// Close all connections
		for (const [_url, ws] of this.connections.entries()) {
			if (ws.readyState === WebSocket.OPEN) {
				ws.close();
			}
		}

		this.connections.clear();
		this.initialized = false;
	}

	/**
	 * Get or create a WebSocket connection
	 */
	private async getConnection(url: string): Promise<WebSocket> {
		// Check if connection exists and is open
		const existing = this.connections.get(url);
		if (existing && existing.readyState === WebSocket.OPEN) {
			return existing;
		}

		// Create new connection
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(url);

			ws.on('open', () => {
				this.connections.set(url, ws);
				resolve(ws);
			});

			ws.on('error', (error) => {
				reject(new Error(`WebSocket connection failed: ${error.message}`));
			});

			// Timeout for connection
			setTimeout(() => {
				if (ws.readyState !== WebSocket.OPEN) {
					ws.close();
					reject(new Error('WebSocket connection timeout'));
				}
			}, 5000);
		});
	}

	/**
	 * Send message and wait for response
	 */
	private sendAndWaitForResponse(ws: WebSocket, message: string, timeout: number): Promise<any> {
		return new Promise((resolve, reject) => {
			let timeoutId: NodeJS.Timeout;

			// Set up response handler
			const messageHandler = (data: Buffer) => {
				clearTimeout(timeoutId);
				ws.off('message', messageHandler);
				ws.off('error', errorHandler);

				try {
					const response = data.toString();
					// Try to parse as JSON
					try {
						resolve(JSON.parse(response));
					} catch {
						// Not JSON, return as string
						resolve(response);
					}
				} catch (error) {
					reject(error);
				}
			};

			// Set up error handler
			const errorHandler = (error: Error) => {
				clearTimeout(timeoutId);
				ws.off('message', messageHandler);
				ws.off('error', errorHandler);
				reject(new Error(`WebSocket error: ${error.message}`));
			};

			// Set up timeout
			timeoutId = setTimeout(() => {
				ws.off('message', messageHandler);
				ws.off('error', errorHandler);
				reject(new Error(`WebSocket response timeout after ${timeout}ms`));
			}, timeout);

			// Attach handlers
			ws.on('message', messageHandler);
			ws.on('error', errorHandler);

			// Send message
			ws.send(message, (error) => {
				if (error) {
					clearTimeout(timeoutId);
					ws.off('message', messageHandler);
					ws.off('error', errorHandler);
					reject(new Error(`Failed to send WebSocket message: ${error.message}`));
				}
			});
		});
	}

	/**
	 * Get active connection count
	 */
	getConnectionCount(): number {
		return this.connections.size;
	}

	/**
	 * Get list of connected URLs
	 */
	getConnectedURLs(): string[] {
		return Array.from(this.connections.keys());
	}
}
