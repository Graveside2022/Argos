// MCP (Model Context Protocol) integration: dynamic server, config generation, and tool registry

// config-generator
export {
	generateArgosMCPServer,
	generateContextBConfig,
	generateMCPConfigContent,
	getInstallationInstructions,
	installContextBConfig,
	updateExistingConfig
} from './config-generator';

// dynamic-server
export { ArgosMCPServer } from './dynamic-server';

// types
export type {
	MCPConfiguration,
	MCPResource,
	MCPServerConfig,
	MCPServerDefinition,
	MCPTool,
	MCPToolResult
} from './types';
