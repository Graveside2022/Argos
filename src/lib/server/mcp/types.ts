/**
 * MCP (Model Context Protocol) Types
 * Auto-generated MCP servers for Context B/C integration
 */

/**
 * MCP Tool Definition (Anthropic format)
 */
export interface MCPTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, any>;
		required?: string[];
	};
}

/**
 * MCP Resource Definition
 */
export interface MCPResource {
	uri: string;
	name: string;
	description?: string;
	mimeType?: string;
}

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
	name: string;
	version: string;
	description: string;
	capabilities: {
		tools: boolean;
		resources: boolean;
		prompts: boolean;
	};
}

/**
 * MCP Tool Execution Result
 */
export interface MCPToolResult {
	content: Array<{
		type: 'text' | 'image' | 'resource';
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
	isError?: boolean;
}

/**
 * MCP Server for Context B/C
 */
export interface MCPServerDefinition {
	id: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

/**
 * MCP Configuration for Claude CLI
 */
export interface MCPConfiguration {
	mcpServers: Record<string, MCPServerDefinition>;
}

/**
 * Registry change event
 */
export type RegistryChangeEvent =
	| 'tool_added'
	| 'tool_removed'
	| 'hardware_added'
	| 'hardware_removed';

/**
 * Registry change listener
 */
export type RegistryChangeListener = (event: RegistryChangeEvent, id: string) => void;
