/**
 * Base MCP server class with common functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConnectionErrorMessage } from './api-client';

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

			if (!tool) {
				return {
					content: [{ type: 'text', text: `Error: Unknown tool "${name}"` }],
					isError: true
				};
			}

			try {
				const result = await tool.execute(args || {});
				return {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
				};
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);

				// Check if Argos app is running
				if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
					return {
						content: [{ type: 'text', text: getConnectionErrorMessage() }],
						isError: true
					};
				}

				return {
					content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }],
					isError: true
				};
			}
		});
	}

	async start(): Promise<void> {
		console.error(`[${this.serverName}] Starting with ${this.tools.length} tools`);
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error(`[${this.serverName}] Server ready`);
	}

	async stop(): Promise<void> {
		await this.server.close();
	}
}
