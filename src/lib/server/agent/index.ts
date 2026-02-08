// Agent system: LLM agent runtime, tools, and tool execution framework

// frontend-tools
export {
	frontendTools,
	getFrontendToolsForAgent,
	validateFrontendToolCall,
} from "./frontend-tools";
export type { FrontendTool } from "./frontend-tools";

// runtime
export { createAgent } from "./runtime";

// tool-execution (re-export from subdirectory barrel)
export {
	CLIAdapter,
	HTTPAdapter,
	InternalAdapter,
	MCPAdapter,
	ToolExecutor,
	ToolRegistry,
	ToolRouter,
	WebSocketAdapter,
	detectTool,
	executeTool,
	globalExecutor,
	globalRegistry,
	globalRouter,
	initializeToolExecutionFramework,
	isInitialized,
	isToolInstalled,
	rescanTools,
	scanInstalledTools,
} from "./tool-execution";
export type {
	BackendConfig,
	BackendType,
	CLIBackendConfig,
	ExecutionContext,
	ExecutionStatus,
	HTTPBackendConfig,
	InternalBackendConfig,
	MCPBackendConfig,
	ToolBackendAdapter,
	ToolDefinition,
	ToolExecutionRequest,
	ToolExecutionResult,
	ToolNamespace,
	ToolParameter,
	ToolQueryOptions,
	WebSocketBackendConfig,
} from "./tool-execution";

// tools
export { argosTools, getAllTools, getSystemPrompt } from "./tools";
