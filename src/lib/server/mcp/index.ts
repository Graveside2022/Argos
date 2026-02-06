/**
 * MCP (Model Context Protocol) Integration
 * Auto-generates and manages MCP servers for Context B/C
 */

// Dynamic MCP Server
export { ArgosMCPServer, startArgosMCPServer } from './dynamic-server';

// Configuration Generation
export {
	generateContextBConfig,
	generateContextCConfig,
	installContextBConfig,
	installContextCConfig,
	generateMCPConfigContent,
	updateExistingConfig,
	getInstallationInstructions
} from './config-generator';

// Registry Integration
export {
	registryEvents,
	enableToolRegistryEvents,
	enableHardwareRegistryEvents,
	setupMCPRegistryListeners,
	initializeMCPIntegration
} from './registry-integration';

// Types
export type {
	MCPTool,
	MCPResource,
	MCPServerConfig,
	MCPToolResult,
	MCPServerDefinition,
	MCPConfiguration,
	RegistryChangeEvent,
	RegistryChangeListener
} from './types';
