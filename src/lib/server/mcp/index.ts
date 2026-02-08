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
	updateExistingConfig,
} from "./config-generator";

// dynamic-server
export { ArgosMCPServer } from "./dynamic-server";

// registry-integration
export {
	enableHardwareRegistryEvents,
	enableToolRegistryEvents,
	initializeMCPIntegration,
	registryEvents,
	setupMCPRegistryListeners,
} from "./registry-integration";

// server
export { createMCPServer, startMCPServer } from "./server";

// tools (re-export from subdirectory barrel)
export { ALL_TOOLS, executeTool as executeMCPTool } from "./tools";

// types
export type {
	MCPConfiguration,
	MCPResource,
	MCPServerConfig,
	MCPServerDefinition,
	MCPTool,
	MCPToolResult,
	RegistryChangeEvent,
	RegistryChangeListener,
} from "./types";
