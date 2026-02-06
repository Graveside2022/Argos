/**
 * Tool Execution Framework - Type Definitions
 *
 * Defines interfaces for the multi-backend tool execution layer that supports
 * MCP servers, HTTP APIs, CLI tools, and WebSocket services.
 */

/**
 * Tool namespace for organization (device.*, network.*, spectrum.*, etc.)
 */
export type ToolNamespace = string;

/**
 * Backend types supported by the framework
 */
export type BackendType = 'mcp' | 'http' | 'cli' | 'websocket' | 'internal';

/**
 * Tool execution status
 */
export type ExecutionStatus = 'success' | 'error' | 'timeout' | 'not_found';

/**
 * Tool parameter definition (JSON Schema compatible)
 */
export interface ToolParameter {
	type: string;
	description: string;
	required?: boolean;
	default?: any;
	enum?: string[];
	properties?: Record<string, ToolParameter>;
}

/**
 * Tool metadata and configuration
 */
export interface ToolDefinition {
	/** Unique tool identifier (e.g., "device.get_details") */
	name: string;

	/** Tool namespace for organization */
	namespace: ToolNamespace;

	/** Human-readable description */
	description: string;

	/** Backend type handling this tool */
	backendType: BackendType;

	/** Backend-specific configuration */
	backendConfig: BackendConfig;

	/** Input parameters schema */
	parameters: Record<string, ToolParameter>;

	/** Required parameter names */
	requiredParameters: string[];

	/** Workflows where this tool is relevant (empty = always available) */
	workflows?: string[];

	/** Whether this tool requires authentication */
	requiresAuth?: boolean;

	/** Estimated execution time (ms) */
	estimatedDuration?: number;

	/** Tags for filtering */
	tags?: string[];
}

/**
 * Backend-specific configuration union type
 */
export type BackendConfig =
	| MCPBackendConfig
	| HTTPBackendConfig
	| CLIBackendConfig
	| WebSocketBackendConfig
	| InternalBackendConfig;

/**
 * MCP (Model Context Protocol) server configuration
 */
export interface MCPBackendConfig {
	type: 'mcp';
	/** MCP server URL or stdio command */
	server: string | { command: string; args: string[] };
	/** Server identifier */
	serverId: string;
	/** Tool name on the MCP server */
	mcpToolName: string;
}

/**
 * HTTP API configuration
 */
export interface HTTPBackendConfig {
	type: 'http';
	/** Base URL for the API */
	baseUrl: string;
	/** HTTP method */
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	/** URL path (supports templating: /device/{deviceId}) */
	path: string;
	/** Headers to include */
	headers?: Record<string, string>;
	/** Authentication type */
	auth?: {
		type: 'none' | 'bearer' | 'basic' | 'apikey';
		token?: string;
		username?: string;
		password?: string;
		headerName?: string;
	};
	/** Timeout in milliseconds */
	timeout?: number;
}

/**
 * Command-line tool configuration
 */
export interface CLIBackendConfig {
	type: 'cli';
	/** Command to execute */
	command: string;
	/** Argument template (supports {{param}} interpolation) */
	args?: string[];
	/** Working directory */
	cwd?: string;
	/** Environment variables */
	env?: Record<string, string>;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Whether to run in shell */
	shell?: boolean;
}

/**
 * WebSocket service configuration
 */
export interface WebSocketBackendConfig {
	type: 'websocket';
	/** WebSocket URL */
	url: string;
	/** Request message format */
	requestFormat: 'json' | 'text';
	/** Response timeout */
	timeout?: number;
}

/**
 * Internal function handler (for built-in tools)
 */
export interface InternalBackendConfig {
	type: 'internal';
	/** Handler function name */
	handler: string;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
	/** Tool name to execute */
	toolName: string;

	/** Input parameters */
	parameters: Record<string, any>;

	/** Execution context (user, workflow, etc.) */
	context?: ExecutionContext;

	/** Timeout override */
	timeout?: number;
}

/**
 * Execution context for tool calls
 */
export interface ExecutionContext {
	/** Current workflow type */
	workflow?: string;

	/** User/operator identifier */
	userId?: string;

	/** Selected device/entity */
	selectedEntity?: string;

	/** Geographic location */
	location?: {
		lat: number;
		lon: number;
	};

	/** Additional context data */
	metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
	/** Execution status */
	status: ExecutionStatus;

	/** Tool that was executed */
	toolName: string;

	/** Result data (if successful) */
	data?: any;

	/** Error message (if failed) */
	error?: string;

	/** Error details */
	errorDetails?: any;

	/** Execution duration in milliseconds */
	duration: number;

	/** Timestamp */
	timestamp: number;

	/** Backend that handled execution */
	backend: BackendType;
}

/**
 * Tool registry query options
 */
export interface ToolQueryOptions {
	/** Filter by namespace */
	namespace?: ToolNamespace;

	/** Filter by workflow */
	workflow?: string;

	/** Filter by tags */
	tags?: string[];

	/** Filter by backend type */
	backendType?: BackendType;

	/** Search query */
	search?: string;
}

/**
 * Backend adapter interface - all adapters must implement this
 */
export interface ToolBackendAdapter {
	/** Backend type identifier */
	readonly type: BackendType;

	/** Initialize the adapter */
	initialize(): Promise<void>;

	/** Execute a tool */
	execute(
		tool: ToolDefinition,
		parameters: Record<string, any>,
		context?: ExecutionContext
	): Promise<ToolExecutionResult>;

	/** Test if backend is available */
	healthCheck(): Promise<boolean>;

	/** Cleanup resources */
	cleanup(): Promise<void>;
}
