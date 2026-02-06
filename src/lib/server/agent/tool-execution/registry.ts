/**
 * Tool Registry
 *
 * Central registry for all available tools with namespace organization,
 * workflow filtering, and dynamic tool discovery.
 */

import type { ToolDefinition, ToolNamespace, ToolQueryOptions, BackendType } from './types';

/**
 * Tool Registry - manages all registered tools
 */
export class ToolRegistry {
	private tools: Map<string, ToolDefinition> = new Map();
	private namespaces: Set<ToolNamespace> = new Set();

	/**
	 * Register a new tool
	 */
	register(tool: ToolDefinition): void {
		// Validate tool definition
		this.validateTool(tool);

		// Register tool
		this.tools.set(tool.name, tool);
		this.namespaces.add(tool.namespace);

		console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.backendType})`);
	}

	/**
	 * Register multiple tools
	 */
	registerBulk(tools: ToolDefinition[]): void {
		for (const tool of tools) {
			this.register(tool);
		}
	}

	/**
	 * Get a tool by name
	 */
	get(toolName: string): ToolDefinition | undefined {
		return this.tools.get(toolName);
	}

	/**
	 * Check if a tool exists
	 */
	has(toolName: string): boolean {
		return this.tools.has(toolName);
	}

	/**
	 * Query tools with filters
	 */
	query(options: ToolQueryOptions = {}): ToolDefinition[] {
		let results = Array.from(this.tools.values());

		// Filter by namespace
		if (options.namespace) {
			results = results.filter((t) => t.namespace === options.namespace);
		}

		// Filter by workflow
		if (options.workflow) {
			results = results.filter(
				(t) =>
					!t.workflows ||
					t.workflows.length === 0 ||
					t.workflows.includes(options.workflow!)
			);
		}

		// Filter by tags
		if (options.tags && options.tags.length > 0) {
			results = results.filter((t) => options.tags!.some((tag) => t.tags?.includes(tag)));
		}

		// Filter by backend type
		if (options.backendType) {
			results = results.filter((t) => t.backendType === options.backendType);
		}

		// Search filter
		if (options.search) {
			const query = options.search.toLowerCase();
			results = results.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.description.toLowerCase().includes(query) ||
					t.tags?.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		return results;
	}

	/**
	 * Get all tools in a namespace
	 */
	getNamespace(namespace: ToolNamespace): ToolDefinition[] {
		return this.query({ namespace });
	}

	/**
	 * Get all available namespaces
	 */
	getNamespaces(): ToolNamespace[] {
		return Array.from(this.namespaces);
	}

	/**
	 * Get tools for a specific workflow
	 */
	getWorkflowTools(workflow: string): ToolDefinition[] {
		return this.query({ workflow });
	}

	/**
	 * Get all tools
	 */
	getAll(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tool count
	 */
	count(): number {
		return this.tools.size;
	}

	/**
	 * Clear all tools
	 */
	clear(): void {
		this.tools.clear();
		this.namespaces.clear();
		console.log('[ToolRegistry] Cleared all tools');
	}

	/**
	 * Unregister a tool
	 */
	unregister(toolName: string): boolean {
		const deleted = this.tools.delete(toolName);
		if (deleted) {
			console.log(`[ToolRegistry] Unregistered tool: ${toolName}`);
		}
		return deleted;
	}

	/**
	 * Get registry statistics
	 */
	getStats(): {
		totalTools: number;
		namespaces: number;
		byBackend: Record<BackendType, number>;
		byNamespace: Record<string, number>;
	} {
		const byBackend: Record<string, number> = {};
		const byNamespace: Record<string, number> = {};

		for (const tool of this.tools.values()) {
			// Count by backend
			byBackend[tool.backendType] = (byBackend[tool.backendType] || 0) + 1;

			// Count by namespace
			byNamespace[tool.namespace] = (byNamespace[tool.namespace] || 0) + 1;
		}

		return {
			totalTools: this.tools.size,
			namespaces: this.namespaces.size,
			byBackend: byBackend as Record<BackendType, number>,
			byNamespace
		};
	}

	/**
	 * Validate tool definition
	 */
	private validateTool(tool: ToolDefinition): void {
		if (!tool.name) {
			throw new Error('Tool must have a name');
		}

		if (!tool.namespace) {
			throw new Error(`Tool ${tool.name} must have a namespace`);
		}

		if (!tool.backendType) {
			throw new Error(`Tool ${tool.name} must have a backendType`);
		}

		if (!tool.backendConfig) {
			throw new Error(`Tool ${tool.name} must have backendConfig`);
		}

		// Validate namespace format (should be dot-separated)
		if (!tool.namespace.match(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)) {
			throw new Error(
				`Tool ${tool.name} has invalid namespace format: ${tool.namespace}. Use lowercase with dots (e.g., "device.wifi")`
			);
		}
	}

	/**
	 * Export tools as JSON
	 */
	toJSON(): Record<string, any> {
		return {
			tools: Array.from(this.tools.entries()).map(([name, tool]) => ({
				name,
				...tool
			})),
			stats: this.getStats()
		};
	}
}

/**
 * Global registry instance (singleton)
 */
export const globalRegistry = new ToolRegistry();
