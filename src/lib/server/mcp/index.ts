// MCP (Model Context Protocol) integration: dynamic server, config generation, and tool registry

// config-generator
export {
	generateArgosMCPServer,
	generateContextBConfig,
	generateContextCConfig,
	generateMCPConfigContent,
	getInstallationInstructions,
	installContextBConfig,
	installContextCConfig,
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
