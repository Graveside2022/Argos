/**
 * Tool Execution Framework
 *
 * Unified tool execution layer supporting multiple backend types:
 * - MCP (Model Context Protocol) servers
 * - HTTP/REST APIs
 * - Command-line tools
 * - WebSocket services
 * - Internal handlers
 *
 * Features:
 * - Auto-detection of installed tools (Docker, native binaries, SystemD services)
 * - Dynamic registration with tool execution framework
 * - Namespace organization for 90+ tools
 * - Multi-backend support with unified API
 *
 * Usage:
 *   import { globalExecutor, globalRegistry } from '$lib/server/agent/tool-execution';
 *
 *   // Execute a tool
 *   const result = await globalExecutor.execute('device.get_details', { device_id: 'ABC123' });
 *
 *   // Query available tools
 *   const tools = globalRegistry.query({ namespace: 'device' });
 */

// Core components
export { ToolRegistry, globalRegistry } from './registry';
export { ToolRouter, globalRouter } from './router';
export { ToolExecutor, globalExecutor, executeTool } from './executor';

// Initialization
export { initializeToolExecutionFramework, isInitialized, rescanTools } from './init';

// Detection
export { scanInstalledTools, detectTool, isToolInstalled } from './detection';

// Backend adapters
export { HTTPAdapter, CLIAdapter, InternalAdapter, MCPAdapter, WebSocketAdapter } from './adapters';

// Type definitions
export type {
	ToolDefinition,
	ToolParameter,
	ToolNamespace,
	BackendType,
	BackendConfig,
	MCPBackendConfig,
	HTTPBackendConfig,
	CLIBackendConfig,
	WebSocketBackendConfig,
	InternalBackendConfig,
	ToolExecutionRequest,
	ToolExecutionResult,
	ExecutionContext,
	ExecutionStatus,
	ToolQueryOptions,
	ToolBackendAdapter
} from './types';
