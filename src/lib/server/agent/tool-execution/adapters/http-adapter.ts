/**
 * HTTP Backend Adapter
 *
 * Executes tools by calling HTTP/REST APIs (Kismet, custom services, etc.)
 */

/* eslint-disable no-undef */
import type {
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionResult,
	ExecutionContext,
	HTTPBackendConfig
} from '$lib/server/agent/tool-execution/types';

export class HTTPAdapter implements ToolBackendAdapter {
	readonly type = 'http' as const;
	private initialized = false;

	async initialize(): Promise<void> {
		console.log('[HTTPAdapter] Initializing HTTP adapter...');
		this.initialized = true;
	}

	async execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		_context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();
		const config = tool.backendConfig as HTTPBackendConfig;

		try {
			// Build URL with path parameter interpolation
			const url = this.buildURL(config.baseUrl, config.path, parameters);

			// Build headers
			const headers = this.buildHeaders(config);

			// Build request body or query params
			const requestOptions: RequestInit = {
				method: config.method,
				headers,
				signal: AbortSignal.timeout(config.timeout || 30000)
			};

			// Add body for POST/PUT/DELETE
			if (config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE') {
				requestOptions.body = JSON.stringify(parameters);
			}

			console.log(`[HTTPAdapter] ${config.method} ${url}`);

			// Execute request
			const response = await fetch(url, requestOptions);

			// Parse response
			const contentType = response.headers.get('content-type');
			let data: any;

			if (contentType?.includes('application/json')) {
				data = await response.json();
			} else {
				data = await response.text();
			}

			// Check if successful
			if (!response.ok) {
				return {
					status: 'error',
					toolName: tool.name,
					error: `HTTP ${response.status}: ${response.statusText}`,
					errorDetails: data,
					duration: Date.now() - startTime,
					timestamp: Date.now(),
					backend: this.type
				};
			}

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
			if (error instanceof Error && error.name === 'TimeoutError') {
				return {
					status: 'timeout',
					toolName: tool.name,
					error: 'Request timed out',
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
		return this.initialized;
	}

	async cleanup(): Promise<void> {
		console.log('[HTTPAdapter] Cleaning up HTTP adapter...');
		this.initialized = false;
	}

	/**
	 * Build URL with path parameter interpolation
	 * Example: /device/{deviceId} + {deviceId: "ABC"} -> /device/ABC
	 */
	private buildURL(baseUrl: string, path: string, parameters: Record<string, any>): string {
		let interpolatedPath = path;

		// Replace {param} with actual values
		for (const [key, value] of Object.entries(parameters)) {
			const placeholder = `{${key}}`;
			if (interpolatedPath.includes(placeholder)) {
				interpolatedPath = interpolatedPath.replace(placeholder, String(value));
			}
		}

		// Combine base URL and path
		const url = new URL(interpolatedPath, baseUrl);

		// Add query parameters for GET requests
		if (path === interpolatedPath) {
			// No path params were used, add as query params for GET
			for (const [key, value] of Object.entries(parameters)) {
				url.searchParams.append(key, String(value));
			}
		}

		return url.toString();
	}

	/**
	 * Build request headers with authentication
	 */
	private buildHeaders(config: HTTPBackendConfig): HeadersInit {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(config.headers || {})
		};

		// Add authentication
		if (config.auth) {
			switch (config.auth.type) {
				case 'bearer':
					if (config.auth.token) {
						headers['Authorization'] = `Bearer ${config.auth.token}`;
					}
					break;

				case 'basic':
					if (config.auth.username && config.auth.password) {
						const credentials = btoa(`${config.auth.username}:${config.auth.password}`);
						headers['Authorization'] = `Basic ${credentials}`;
					}
					break;

				case 'apikey':
					if (config.auth.headerName && config.auth.token) {
						headers[config.auth.headerName] = config.auth.token;
					}
					break;
			}
		}

		return headers;
	}
}
