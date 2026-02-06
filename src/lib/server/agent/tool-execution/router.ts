/**
 * Tool Router
 *
 * Routes tool execution requests to the appropriate backend adapter
 * based on the tool's backend type.
 */

import type {
	ToolDefinition,
	ToolBackendAdapter,
	BackendType,
	ToolExecutionRequest,
	ToolExecutionResult
} from './types';
import { globalRegistry } from './registry';

/**
 * Tool Router - dispatches tool calls to backend adapters
 */
export class ToolRouter {
	private adapters: Map<BackendType, ToolBackendAdapter> = new Map();

	/**
	 * Register a backend adapter
	 */
	registerAdapter(adapter: ToolBackendAdapter): void {
		this.adapters.set(adapter.type, adapter);
		console.log(`[ToolRouter] Registered adapter: ${adapter.type}`);
	}

	/**
	 * Get an adapter by type
	 */
	getAdapter(type: BackendType): ToolBackendAdapter | undefined {
		return this.adapters.get(type);
	}

	/**
	 * Check if an adapter is registered
	 */
	hasAdapter(type: BackendType): boolean {
		return this.adapters.has(type);
	}

	/**
	 * Route a tool execution request to the appropriate backend
	 */
	async route(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
		const startTime = Date.now();

		try {
			// Get tool definition from registry
			const tool = globalRegistry.get(request.toolName);
			if (!tool) {
				return this.createErrorResult(
					request.toolName,
					'not_found',
					`Tool not found: ${request.toolName}`,
					Date.now() - startTime
				);
			}

			// Validate parameters
			const validationError = this.validateParameters(tool, request.parameters);
			if (validationError) {
				return this.createErrorResult(
					request.toolName,
					'error',
					validationError,
					Date.now() - startTime,
					tool.backendType
				);
			}

			// Get appropriate adapter
			const adapter = this.adapters.get(tool.backendType);
			if (!adapter) {
				return this.createErrorResult(
					request.toolName,
					'error',
					`No adapter registered for backend type: ${tool.backendType}`,
					Date.now() - startTime,
					tool.backendType
				);
			}

			// Execute tool through adapter
			console.log(`[ToolRouter] Routing ${request.toolName} to ${tool.backendType} adapter`);
			const result = await adapter.execute(tool, request.parameters, request.context);

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error(`[ToolRouter] Routing error for ${request.toolName}:`, error);

			return this.createErrorResult(
				request.toolName,
				'error',
				error instanceof Error ? error.message : String(error),
				duration,
				undefined,
				error
			);
		}
	}

	/**
	 * Initialize all registered adapters
	 */
	async initializeAll(): Promise<void> {
		console.log('[ToolRouter] Initializing all adapters...');
		const promises = Array.from(this.adapters.values()).map((adapter) =>
			adapter.initialize().catch((err) => {
				console.error(`[ToolRouter] Failed to initialize ${adapter.type} adapter:`, err);
			})
		);
		await Promise.all(promises);
		console.log('[ToolRouter] All adapters initialized');
	}

	/**
	 * Health check all adapters
	 */
	async healthCheckAll(): Promise<Record<BackendType, boolean>> {
		const results: Record<string, boolean> = {};

		for (const [type, adapter] of this.adapters.entries()) {
			try {
				results[type] = await adapter.healthCheck();
			} catch (error) {
				console.error(`[ToolRouter] Health check failed for ${type}:`, error);
				results[type] = false;
			}
		}

		return results as Record<BackendType, boolean>;
	}

	/**
	 * Cleanup all adapters
	 */
	async cleanupAll(): Promise<void> {
		console.log('[ToolRouter] Cleaning up all adapters...');
		const promises = Array.from(this.adapters.values()).map((adapter) =>
			adapter.cleanup().catch((err) => {
				console.error(`[ToolRouter] Failed to cleanup ${adapter.type} adapter:`, err);
			})
		);
		await Promise.all(promises);
		console.log('[ToolRouter] All adapters cleaned up');
	}

	/**
	 * Get router statistics
	 */
	getStats(): {
		registeredAdapters: BackendType[];
		adapterCount: number;
	} {
		return {
			registeredAdapters: Array.from(this.adapters.keys()),
			adapterCount: this.adapters.size
		};
	}

	/**
	 * Validate tool parameters against schema
	 */
	private validateParameters(
		tool: ToolDefinition,
		parameters: Record<string, any>
	): string | null {
		// Check required parameters
		for (const required of tool.requiredParameters) {
			if (!(required in parameters)) {
				return `Missing required parameter: ${required}`;
			}
		}

		// Basic type validation
		for (const [paramName, paramValue] of Object.entries(parameters)) {
			const paramSchema = tool.parameters[paramName];
			if (!paramSchema) {
				// Unknown parameter - allow it for flexibility
				continue;
			}

			// Type validation
			const actualType = typeof paramValue;
			const expectedType = paramSchema.type;

			if (expectedType === 'number' && actualType !== 'number') {
				return `Parameter ${paramName} must be a number, got ${actualType}`;
			}

			if (expectedType === 'string' && actualType !== 'string') {
				return `Parameter ${paramName} must be a string, got ${actualType}`;
			}

			if (expectedType === 'boolean' && actualType !== 'boolean') {
				return `Parameter ${paramName} must be a boolean, got ${actualType}`;
			}

			// Enum validation
			if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
				return `Parameter ${paramName} must be one of: ${paramSchema.enum.join(', ')}`;
			}
		}

		return null;
	}

	/**
	 * Create an error result
	 */
	private createErrorResult(
		toolName: string,
		status: 'error' | 'timeout' | 'not_found',
		error: string,
		duration: number,
		backend?: BackendType,
		errorDetails?: any
	): ToolExecutionResult {
		return {
			status,
			toolName,
			error,
			errorDetails,
			duration,
			timestamp: Date.now(),
			backend: backend || 'internal'
		};
	}
}

/**
 * Global router instance (singleton)
 */
export const globalRouter = new ToolRouter();
