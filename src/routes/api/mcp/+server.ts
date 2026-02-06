/**
 * MCP Server HTTP Endpoint
 * Serves Argos MCP tools over HTTP for AG-UI middleware integration
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ALL_TOOLS, executeTool } from '$lib/server/mcp/tools';

/**
 * List all available MCP tools
 */
export const GET: RequestHandler = async () => {
	return json({
		tools: ALL_TOOLS,
		server: {
			name: 'argos-sdr-mcp',
			version: '1.0.0'
		}
	});
};

/**
 * Execute MCP tool
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { method, params } = body;

		if (method === 'tools/list') {
			return json({
				tools: ALL_TOOLS
			});
		}

		if (method === 'tools/call') {
			const { name, arguments: args } = params;
			const result = await executeTool(name, args || {});

			return json({
				content: [
					{
						type: 'text',
						text: JSON.stringify(result, null, 2)
					}
				]
			});
		}

		return json(
			{
				error: {
					code: -32601,
					message: `Unknown method: ${method}`
				}
			},
			{ status: 400 }
		);
	} catch (error) {
		return json(
			{
				error: {
					code: -32603,
					message: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
