/**
 * Base MCP server class with common functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { logger } from '$lib/utils/logger';

import { getConnectionErrorMessage } from './api-client';

/** Build an MCP error response. */
function mcpError(text: string) {
	return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

/** Check if error indicates Argos app is unreachable. */
function isConnectionError(msg: string): boolean {
	return msg.includes('ECONNREFUSED') || msg.includes('fetch failed');
}

/** Format a tool execution error into an MCP response. */
function formatToolError(toolName: string, error: unknown) {
	const msg = error instanceof Error ? error.message : String(error);
	if (isConnectionError(msg)) return mcpError(getConnectionErrorMessage());
	return mcpError(`executing ${toolName}: ${msg}`);
}

export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export abstract class BaseMCPServer {
	protected server: Server;
	protected serverName: string;
	protected abstract tools: ToolDefinition[];

	constructor(serverName: string) {
		this.serverName = serverName;
		this.server = new Server(
			{ name: this.serverName, version: '1.0.0' },
			{ capabilities: { tools: {} } }
		);
		this.setupHandlers();
	}

	private setupHandlers(): void {
		// List tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: this.tools.map(({ name, description, inputSchema }) => ({
					name,
					description,
					inputSchema
				}))
			};
		});

		// Execute tool
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			const tool = this.tools.find((t) => t.name === name);
			if (!tool) return mcpError(`Unknown tool "${name}"`);

			try {
				const result = await tool.execute(args || {});
				return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
			} catch (error) {
				return formatToolError(name, error);
			}
		});
	}

	async start(): Promise<void> {
		logger.info('MCP server starting', {
			server: this.serverName,
			toolCount: this.tools.length
		});
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		logger.info('MCP server ready', { server: this.serverName });
	}

	async stop(): Promise<void> {
		await this.server.close();
	}
}
