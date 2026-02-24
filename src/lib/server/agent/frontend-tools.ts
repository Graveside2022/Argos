/**
 * Frontend Tools — MCP Format Adapter
 *
 * Converts the frontend tool definitions into the MCP tool format
 * expected by the agent runtime.
 */

import { frontendTools } from '$lib/server/agent/frontend-tool-definitions';

export type { FrontendTool } from '$lib/server/agent/frontend-tool-definitions';
export { frontendTools } from '$lib/server/agent/frontend-tool-definitions';

/**
 * Get frontend tools in MCP format for agent context
 */
export function getFrontendToolsForAgent(): Array<{
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		properties: Record<string, unknown>;
		required: string[];
	};
}> {
	return frontendTools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: {
			type: 'object' as const,
			properties: Object.entries(tool.parameters).reduce(
				(acc, [key, param]) => ({
					...acc,
					[key]: {
						type: param.type,
						description: param.description,
						...(param.enum ? { enum: param.enum } : {})
					}
				}),
				{}
			),
			required: Object.entries(tool.parameters)
				.filter(([, param]) => param.required)
				.map(([key]) => key)
		}
	}));
}
