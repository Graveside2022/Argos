/**
 * Dynamic Argos MCP Server
 * Exposes Argos tools to Claude Code via Model Context Protocol
 *
 * This runs as a standalone process (via npx tsx), so it communicates
 * with the running Argos app via HTTP API calls to localhost:5173.
 *
 * Tool definitions are split across:
 * - dynamic-server-tools.ts (device and signal analysis tools)
 * - dynamic-server-tools-system.ts (system status and hardware tools)
 * - dynamic-server-types.ts (shared type definitions)
 */

/* eslint-disable no-undef */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { createDeviceTools } from './dynamic-server-tools';
import { createSystemTools } from './dynamic-server-tools-system';
import type { ArgosTool } from './dynamic-server-types';

// Load .env for ARGOS_API_KEY (standalone process, not SvelteKit)
config();

const ARGOS_API = process.env.ARGOS_API_URL || 'http://localhost:5173';

/**
 * Fetch helper with timeout and API key injection for Argos HTTP API calls.
 * Used by all MCP tool execute() callbacks to reach the running Argos app.
 */
async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
	const url = `${ARGOS_API}${path}`;
	const apiKey = process.env.ARGOS_API_KEY || '';
	const resp = await fetch(url, {
		...options,
		signal: AbortSignal.timeout(15000),
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'X-API-Key': apiKey } : {}),
			...options?.headers
		}
	});
	if (!resp.ok) {
		throw new Error(`Argos API error: ${resp.status} ${resp.statusText} for ${path}`);
	}
	return resp;
}

/** All MCP tool definitions, assembled from device and system tool modules */
const ARGOS_TOOLS: ArgosTool[] = [...createDeviceTools(apiFetch), ...createSystemTools(apiFetch)];

/**
 * Argos MCP Server -- exposes RF/network analysis tools to Claude Code.
 * Registers MCP request handlers for tool listing, tool execution,
 * resource listing, and resource reading.
 */
export class ArgosMCPServer {
	private server: Server;

	constructor() {
		this.server = new Server(
			{ name: 'argos-tools', version: '1.0.0' },
			{ capabilities: { tools: {}, resources: {} } }
		);
		this.setupHandlers();
	}

	private setupHandlers(): void {
		// List tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: ARGOS_TOOLS.map(({ name, description, inputSchema }) => ({
					name,
					description,
					inputSchema
				}))
			};
		});

		// Execute tool
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			const tool = ARGOS_TOOLS.find((t) => t.name === name);

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
						content: [
							{
								type: 'text',
								text: `Error: Cannot reach Argos at ${ARGOS_API}. Is the Argos dev server running? (npm run dev)`
							}
						],
						isError: true
					};
				}

				return {
					content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }],
					isError: true
				};
			}
		});

		// List resources
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
			return {
				resources: [
					{
						uri: 'argos://system/status',
						name: 'System Status',
						description: 'Current Argos system status (CPU, memory, uptime)',
						mimeType: 'application/json'
					},
					{
						uri: 'argos://kismet/status',
						name: 'Kismet Status',
						description: 'WiFi scanner service status',
						mimeType: 'application/json'
					},
					{
						uri: 'argos://devices/active',
						name: 'Active Devices',
						description: 'Currently detected WiFi devices',
						mimeType: 'application/json'
					}
				]
			};
		});

		// Read resource
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
			const { uri } = request.params;

			try {
				let data: unknown;
				if (uri === 'argos://system/status') {
					const resp = await apiFetch('/api/system/stats');
					data = await resp.json();
				} else if (uri === 'argos://kismet/status') {
					const resp = await apiFetch('/api/kismet/status');
					data = await resp.json();
				} else if (uri === 'argos://devices/active') {
					const resp = await apiFetch('/api/kismet/devices');
					data = await resp.json();
				} else {
					return {
						contents: [
							{ uri, mimeType: 'text/plain', text: `Unknown resource: ${uri}` }
						]
					};
				}

				return {
					contents: [
						{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
					]
				};
			} catch (error) {
				return {
					contents: [
						{
							uri,
							mimeType: 'text/plain',
							text: `Error: ${error instanceof Error ? error.message : String(error)}`
						}
					]
				};
			}
		});
	}

	/** Start the MCP server on stdio transport */
	async start(): Promise<void> {
		logger.info('ArgosMCP starting', { toolCount: ARGOS_TOOLS.length });
		logger.info('ArgosMCP API endpoint', { api: ARGOS_API });
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		logger.info('ArgosMCP server ready');
	}

	/** Gracefully shut down the MCP server */
	async stop(): Promise<void> {
		await this.server.close();
	}
}

// Start server when run directly
const server = new ArgosMCPServer();
server.start().catch((error) => {
	logger.error('ArgosMCP fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
