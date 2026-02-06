/**
 * MCP Backend Adapter
 *
 * Executes tools by connecting to Model Context Protocol (MCP) servers
 */

import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type {
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionResult,
	ExecutionContext,
	MCPBackendConfig
} from '../types';

interface MCPServerConnection {
	client: Client;
	transport: StdioClientTransport;
	serverId: string;
}

export class MCPAdapter implements ToolBackendAdapter {
	readonly type = 'mcp' as const;
	private initialized = false;
	private connections: Map<string, MCPServerConnection> = new Map();

	async initialize(): Promise<void> {
		console.log('[MCPAdapter] Initializing MCP adapter...');
		this.initialized = true;
	}

	/**
	 * Connect to an MCP server (stdio transport)
	 */
	async connectServer(serverId: string, command: string, args: string[]): Promise<void> {
		if (this.connections.has(serverId)) {
			console.log(`[MCPAdapter] Server ${serverId} already connected`);
			return;
		}

		try {
			console.log(`[MCPAdapter] Connecting to MCP server: ${serverId} (${command})`);

			// Create stdio transport
			const transport = new StdioClientTransport({
				command,
				args
			});

			// Create client
			const client = new Client(
				{
					name: 'argos-tool-executor',
					version: '1.0.0'
				},
				{
					capabilities: {}
				}
			);

			// Connect
			await client.connect(transport);

			// Store connection
			this.connections.set(serverId, {
				client,
				transport,
				serverId
			});

			console.log(`[MCPAdapter] Connected to MCP server: ${serverId}`);
		} catch (error) {
			console.error(`[MCPAdapter] Failed to connect to ${serverId}:`, error);
			throw new Error(`Failed to connect to MCP server ${serverId}: ${error}`);
		}
	}

	/**
	 * Disconnect from an MCP server
	 */
	async disconnectServer(serverId: string): Promise<void> {
		const connection = this.connections.get(serverId);
		if (!connection) {
			return;
		}

		try {
			await connection.client.close();
			this.connections.delete(serverId);
			console.log(`[MCPAdapter] Disconnected from MCP server: ${serverId}`);
		} catch (error) {
			console.error(`[MCPAdapter] Error disconnecting from ${serverId}:`, error);
		}
	}

	async execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		_context?: ExecutionContext
	): Promise<ToolExecutionResult> {
		const startTime = Date.now();
		const config = tool.backendConfig as MCPBackendConfig;

		try {
			// Ensure server is connected
			if (typeof config.server === 'object') {
				// Stdio server
				if (!this.connections.has(config.serverId)) {
					await this.connectServer(
						config.serverId,
						config.server.command,
						config.server.args
					);
				}
			} else {
				// HTTP server - not yet implemented
				return {
					status: 'error',
					toolName: tool.name,
					error: 'HTTP MCP servers not yet implemented',
					duration: Date.now() - startTime,
					timestamp: Date.now(),
					backend: this.type
				};
			}

			// Get connection
			const connection = this.connections.get(config.serverId);
			if (!connection) {
				return {
					status: 'error',
					toolName: tool.name,
					error: `MCP server not connected: ${config.serverId}`,
					duration: Date.now() - startTime,
					timestamp: Date.now(),
					backend: this.type
				};
			}

			console.log(
				`[MCPAdapter] Calling tool ${config.mcpToolName} on server ${config.serverId}`
			);

			// Call tool on MCP server
			const result = await connection.client.callTool({
				name: config.mcpToolName,
				arguments: parameters
			});

			// Extract data from MCP response
			let data: any;
			if (result.content && result.content.length > 0) {
				// MCP returns content as array of blocks
				if (result.content[0].type === 'text') {
					try {
						// Try to parse as JSON
						data = JSON.parse(result.content[0].text);
					} catch {
						// Not JSON, use as-is
						data = result.content[0].text;
					}
				} else {
					data = result.content;
				}
			} else {
				data = null;
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

		// Check if any servers are connected
		return this.connections.size > 0;
	}

	async cleanup(): Promise<void> {
		console.log('[MCPAdapter] Cleaning up MCP adapter...');

		// Disconnect all servers
		const disconnectPromises = Array.from(this.connections.keys()).map((serverId) =>
			this.disconnectServer(serverId)
		);

		await Promise.all(disconnectPromises);

		this.initialized = false;
	}

	/**
	 * Get connected server count
	 */
	getConnectedServerCount(): number {
		return this.connections.size;
	}

	/**
	 * Get list of connected server IDs
	 */
	getConnectedServers(): string[] {
		return Array.from(this.connections.keys());
	}
}
