/**
 * Argos MCP Server
 * Exposes all SDR/Network/GPS tools via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	type Tool
} from '@modelcontextprotocol/sdk/types.js';

import { hackrfTools } from './tools/hackrf.js';
import { gpsTools } from './tools/gps.js';
import { kismetTools } from './tools/kismet.js';
import { bettercapTools } from './tools/bettercap.js';
import { gsmTools } from './tools/gsm.js';

// Aggregate all tools
const ALL_TOOLS: Tool[] = [
	...hackrfTools,
	...gpsTools,
	...kismetTools,
	...bettercapTools,
	...gsmTools
];

/**
 * Execute MCP tool by calling corresponding Argos API endpoint
 */
async function executeTool(toolName: string, args: Record<string, unknown>) {
	const tool = ALL_TOOLS.find((t) => t.name === toolName);
	if (!tool) {
		throw new Error(`Unknown tool: ${toolName}`);
	}

	const meta = tool._meta as Record<string, unknown>;
	const endpoint = meta.apiEndpoint as string;
	const method = (meta.method as string) || 'GET';
	const baseUrl = process.env.ARGOS_API_URL || 'http://localhost:5173';

	// Build full URL
	let url = `${baseUrl}${endpoint}`;

	// Replace path parameters (e.g., :deviceKey)
	Object.entries(args).forEach(([key, value]) => {
		url = url.replace(`:${key}`, String(value));
	});

	// Make API request
	const apiKey = process.env.ARGOS_API_KEY || '';
	const fetchOptions: globalThis.RequestInit = {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(apiKey ? { 'X-API-Key': apiKey } : {})
		}
	};

	if (method === 'POST' || method === 'PUT') {
		fetchOptions.body = JSON.stringify(args);
	} else if (method === 'GET' && Object.keys(args).length > 0) {
		// Add query parameters for GET requests
		const params = new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]));
		url += `?${params.toString()}`;
	}

	const response = await fetch(url, fetchOptions);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`API error (${response.status}): ${error}`);
	}

	const result = await response.json();
	return result;
}

/**
 * Initialize MCP Server
 */
export function createMCPServer() {
	const server = new Server(
		{
			name: 'argos-sdr-mcp',
			version: '1.0.0'
		},
		{
			capabilities: {
				tools: {}
			}
		}
	);

	// Handle tool listing
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: ALL_TOOLS
		};
	});

	// Handle tool execution
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			const result = await executeTool(name, args || {});

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				]
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${error instanceof Error ? error.message : String(error)}`
					}
				],
				isError: true
			};
		}
	});

	return server;
}

/**
 * Start MCP server in stdio mode (for local agent integration)
 */
export async function startMCPServer() {
	const server = createMCPServer();
	const transport = new StdioServerTransport();

	await server.connect(transport);

	console.error('Argos MCP Server running on stdio');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	startMCPServer().catch((error) => {
		console.error('Failed to start MCP server:', error);
		process.exit(1);
	});
}
