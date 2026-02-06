/**
 * Tool Backend Adapters
 *
 * Exports all backend adapters for the tool execution framework
 */

export { HTTPAdapter } from './http-adapter';
export { CLIAdapter } from './cli-adapter';
export { InternalAdapter, type InternalHandler } from './internal-adapter';
export { MCPAdapter } from './mcp-adapter';
export { WebSocketAdapter } from './websocket-adapter';
