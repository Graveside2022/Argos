/**
 * Tool Executor
 *
 * Main coordination layer for tool execution. Provides high-level API for
 * executing tools, batch execution, and workflow-aware tool selection.
 */

import type {
	ToolExecutionRequest,
	ToolExecutionResult,
	ExecutionContext,
	ToolDefinition,
	ToolQueryOptions
} from './types';
import { globalRegistry } from './registry';
import { globalRouter } from './router';

/**
 * Tool Executor - main entry point for tool execution
 */
export class ToolExecutor {
	/**
	 * Execute a single tool
	 */
	async execute(
		toolName: string,
		parameters: Record<string, any> = {},
		context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const request: ToolExecutionRequest = {
			toolName,
			parameters,
			context
		};

		return await globalRouter.route(request);
	}

	/**
	 * Execute multiple tools in parallel
	 */
	async executeBatch(
		requests: Array<{ toolName: string; parameters: Record<string, any> }>,
		context?: ExecutionContext
	): Promise<ToolExecutionResult[]> {
		console.log(`[ToolExecutor] Executing batch of ${requests.length} tools`);

		const promises = requests.map((req) => this.execute(req.toolName, req.parameters, context));

		return await Promise.all(promises);
	}

	/**
	 * Execute multiple tools sequentially
	 */
	async executeSequence(
		requests: Array<{ toolName: string; parameters: Record<string, any> }>,
		context?: ExecutionContext
	): Promise<ToolExecutionResult[]> {
		console.log(`[ToolExecutor] Executing sequence of ${requests.length} tools`);

		const results: ToolExecutionResult[] = [];

		for (const req of requests) {
			const result = await this.execute(req.toolName, req.parameters, context);
			results.push(result);

			// Stop on error if needed
			if (result.status === 'error') {
				console.warn(`[ToolExecutor] Stopping sequence due to error in ${req.toolName}`);
				break;
			}
		}

		return results;
	}

	/**
	 * Get available tools for current context
	 */
	getAvailableTools(context?: ExecutionContext): ToolDefinition[] {
		const options: ToolQueryOptions = {};

		// Filter by workflow if in context
		if (context?.workflow) {
			options.workflow = context.workflow;
		}

		return globalRegistry.query(options);
	}

	/**
	 * Get tool suggestions based on context
	 */
	suggestTools(query: string, context?: ExecutionContext): ToolDefinition[] {
		const options: ToolQueryOptions = {
			search: query
		};

		if (context?.workflow) {
			options.workflow = context.workflow;
		}

		return globalRegistry.query(options).slice(0, 5); // Top 5 matches
	}

	/**
	 * Get tool by name
	 */
	getTool(toolName: string): ToolDefinition | undefined {
		return globalRegistry.get(toolName);
	}

	/**
	 * Check if tool exists
	 */
	hasTool(toolName: string): boolean {
		return globalRegistry.has(toolName);
	}

	/**
	 * Get all tools in a namespace
	 */
	getNamespaceTools(namespace: string): ToolDefinition[] {
		return globalRegistry.getNamespace(namespace);
	}

	/**
	 * Get execution statistics
	 */
	getStats(): {
		registry: ReturnType<typeof globalRegistry.getStats>;
		router: ReturnType<typeof globalRouter.getStats>;
	} {
		return {
			registry: globalRegistry.getStats(),
			router: globalRouter.getStats()
		};
	}

	/**
	 * Initialize the executor and all adapters
	 */
	async initialize(): Promise<void> {
		console.log('[ToolExecutor] Initializing tool execution framework...');
		await globalRouter.initializeAll();
		console.log('[ToolExecutor] Tool execution framework ready');
	}

	/**
	 * Health check for all backends
	 */
	async healthCheck(): Promise<Record<string, boolean>> {
		return await globalRouter.healthCheckAll();
	}

	/**
	 * Cleanup executor and all adapters
	 */
	async cleanup(): Promise<void> {
		console.log('[ToolExecutor] Cleaning up tool execution framework...');
		await globalRouter.cleanupAll();
		console.log('[ToolExecutor] Cleanup complete');
	}

	/**
	 * Format tool execution result for LLM consumption
	 */
	formatResultForLLM(result: ToolExecutionResult): string {
		if (result.status === 'success') {
			return `Tool: ${result.toolName}\nStatus: Success\nDuration: ${result.duration}ms\n\nResult:\n${JSON.stringify(result.data, null, 2)}`;
		} else {
			return `Tool: ${result.toolName}\nStatus: ${result.status}\nError: ${result.error}\nDuration: ${result.duration}ms`;
		}
	}

	/**
	 * Format multiple results for LLM consumption
	 */
	formatBatchResultsForLLM(results: ToolExecutionResult[]): string {
		const formatted = results.map((r, i) => {
			const header = `=== Tool ${i + 1}/${results.length}: ${r.toolName} ===`;
			const content = this.formatResultForLLM(r);
			return `${header}\n${content}`;
		});

		return formatted.join('\n\n');
	}

	/**
	 * Generate tool definitions for system prompt (Anthropic/Claude format)
	 */
	generateToolSchemas(context?: ExecutionContext): Array<{
		name: string;
		description: string;
		input_schema: {
			type: string;
			properties: Record<string, any>;
			required: string[];
		};
	}> {
		const availableTools = this.getAvailableTools(context);

		return availableTools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: {
				type: 'object',
				properties: tool.parameters,
				required: tool.requiredParameters
			}
		}));
	}
}

/**
 * Global executor instance (singleton)
 */
export const globalExecutor = new ToolExecutor();

/**
 * Convenience function for executing a tool
 */
export async function executeTool(
	toolName: string,
	parameters: Record<string, any> = {},
	context?: ExecutionContext
): Promise<ToolExecutionResult> {
	return await globalExecutor.execute(toolName, parameters, context);
}
