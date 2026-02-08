/**
 * Internal Backend Adapter
 *
 * Executes tools using internal JavaScript/TypeScript handler functions
 */

import type {
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionResult,
	ExecutionContext,
	InternalBackendConfig
} from '$lib/server/agent/tool-execution/types';

/**
 * Internal handler function signature
 */
export type InternalHandler = (
	parameters: Record<string, any>,
	context?: ExecutionContext
) => Promise<any> | any;

export class InternalAdapter implements ToolBackendAdapter {
	readonly type = 'internal' as const;
	private initialized = false;
	private handlers: Map<string, InternalHandler> = new Map();

	async initialize(): Promise<void> {
		console.log('[InternalAdapter] Initializing internal adapter...');
		this.initialized = true;
	}

	/**
	 * Register an internal handler function
	 */
	registerHandler(name: string, handler: InternalHandler): void {
		this.handlers.set(name, handler);
		console.log(`[InternalAdapter] Registered handler: ${name}`);
	}

	/**
	 * Unregister a handler
	 */
	unregisterHandler(name: string): boolean {
		return this.handlers.delete(name);
	}

	async execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();
		const config = tool.backendConfig as InternalBackendConfig;

		try {
			// Get handler function
			const handler = this.handlers.get(config.handler);
			if (!handler) {
				return {
					status: 'error',
					toolName: tool.name,
					error: `Internal handler not found: ${config.handler}`,
					duration: Date.now() - startTime,
					timestamp: Date.now(),
					backend: this.type
				};
			}

			console.log(`[InternalAdapter] Executing handler: ${config.handler}`);

			// Execute handler
			const data = await handler(parameters, context);

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
		console.log('[InternalAdapter] Cleaning up internal adapter...');
		this.handlers.clear();
		this.initialized = false;
	}

	/**
	 * Get registered handler count
	 */
	getHandlerCount(): number {
		return this.handlers.size;
	}

	/**
	 * Get list of registered handler names
	 */
	getHandlerNames(): string[] {
		return Array.from(this.handlers.keys());
	}
}
