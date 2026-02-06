# Agent Integration with Tool Execution Framework

This document describes how the Argos Agent integrates with the Tool Execution Framework to provide access to 90+ tools.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (User)                          │
│              Sends messages to agent                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                /api/agent/stream                            │
│   • Receives user message + context                         │
│   • Builds system prompt with available tools               │
│   • Calls LLM (Ollama or Anthropic)                         │
│   • Streams response back via SSE                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               System Prompt Generation                      │
│                   (tools.ts)                                │
│   • getAllTools() - Fetches from global registry           │
│   • Converts to MCP format                                  │
│   • Injects into system prompt                              │
│   • LLM sees all available tools                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (Agent mentions tool in response)
┌─────────────────────────────────────────────────────────────┐
│              /api/agent/tools (Tool Execution)              │
│   • Receives tool_name + parameters                         │
│   • Checks globalExecutor.hasTool(tool_name)                │
│   • Executes via globalExecutor.execute()                   │
│   • Returns result to frontend                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           Tool Execution Framework                          │
│                (tool-execution/)                            │
│   • Router finds appropriate adapter                        │
│   • Adapter executes tool (CLI, HTTP, MCP, etc.)           │
│   • Returns standardized result                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. System Prompt Generation (`src/lib/server/agent/tools.ts`)

**Function: `getAllTools()`**

- Fetches all registered tools from `globalRegistry`
- Merges legacy hardcoded tools with framework tools
- Converts Tool Execution Framework format → MCP format
- Deduplicates by tool name

**Function: `getSystemPrompt(context)`**

- Builds tactical system prompt with operational context
- Dynamically injects tool list via `getToolListForPrompt()`
- Includes tool invocation instructions for LLM
- Updates automatically when tools are installed/uninstalled

### 2. Tool Execution API (`src/routes/api/agent/tools/+server.ts`)

**POST /api/agent/tools**

- Primary tool execution endpoint for agent
- Routes to Tool Execution Framework via `globalExecutor`
- Falls back to legacy handlers for backward compatibility
- Returns standardized result format:
    ```json
    {
      "success": true,
      "data": { ... },
      "error": null
    }
    ```

**Execution Flow:**

1. Check if tool exists in framework: `globalExecutor.hasTool(tool_name)`
2. Execute via framework: `globalExecutor.execute(tool_name, parameters)`
3. If not found, try legacy handlers (8 hardcoded tools)
4. Return result or error

### 3. Agent Runtime (`src/lib/server/agent/runtime.ts`)

**LLM Integration:**

- **Anthropic Claude**: Native tool calling support (when online)
- **Ollama (llama3.2:1b)**: Text-based tool invocation (offline fallback)

**Key Changes:**

- Imports `getAllTools()` instead of hardcoded `argosTools`
- Passes dynamic tool list to both Anthropic and Ollama processors
- System prompt automatically includes all registered tools

### 4. Streaming Endpoint (`src/routes/api/agent/stream/+server.ts`)

**POST /api/agent/stream**

- SSE endpoint for real-time agent responses
- Builds system prompt with `getSystemPrompt(context)`
- System prompt now includes all 90+ tools from framework
- LLM can reference any installed tool in its response

## Tool Invocation Patterns

### Anthropic Claude (Native Tool Calling)

```json
{
	"type": "tool_use",
	"id": "toolu_123",
	"name": "bluetooth.recon.bluing",
	"input": {
		"target": "AA:BB:CC:DD:EE:FF"
	}
}
```

### Ollama (Text-Based)

Since llama3.2:1b doesn't support native tool calling, the agent mentions tools in text:

```
"I'll use the bluetooth.recon.bluing tool with target: AA:BB:CC:DD:EE:FF"
```

Frontend can parse this and call `/api/agent/tools` directly.

## Dynamic Tool Discovery

### When Tools Are Added to System

1. System scan detects new tool (Docker, binary, or service)
2. Tool is registered in `globalRegistry`
3. `getAllTools()` automatically includes new tool
4. System prompt is regenerated with new tool
5. Agent immediately has access to new tool

### Tool Format Conversion

```typescript
// Tool Execution Framework Format
{
  name: 'bluetooth.recon.bluing',
  namespace: 'bluetooth',
  description: 'Bluetooth Classic/BLE reconnaissance',
  backendType: 'cli',
  backendConfig: { ... },
  parameters: {
    target: { type: 'string', description: 'Target MAC address' }
  },
  requiredParameters: ['target']
}

// ↓ Converted to MCP Format ↓

{
  name: 'bluetooth.recon.bluing',
  description: 'Bluetooth Classic/BLE reconnaissance',
  input_schema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: 'Target MAC address' }
    },
    required: ['target']
  }
}
```

## Usage Examples

### Execute a Tool via Agent

1. User asks: "Scan for Bluetooth devices near AA:BB:CC:DD:EE:FF"
2. Agent sees `bluetooth.recon.bluing` in system prompt
3. Agent responds: "I'll use the bluetooth.recon.bluing tool..."
4. Frontend parses response and calls:
    ```typescript
    POST /api/agent/tools
    {
      "tool_name": "bluetooth.recon.bluing",
      "parameters": { "target": "AA:BB:CC:DD:EE:FF" }
    }
    ```
5. Framework routes to CLI adapter → executes Docker container
6. Result returned to frontend → displayed to user

### Check Available Tools

```typescript
import { getAllTools } from '$lib/server/agent/tools';

const tools = getAllTools();
console.log(`Agent has access to ${tools.length} tools`);
```

### Add New Tool (Automatic)

```bash
# Install tool via Docker
docker run -d --name argos-bluing bluetooth-bluing

# Framework auto-detects on next scan
curl -X GET http://localhost:5173/api/tools/scan

# Tool is now available to agent (no restart needed)
```

## Legacy Tool Compatibility

The integration maintains backward compatibility with 8 hardcoded legacy tools:

- `get_device_details`
- `get_nearby_signals`
- `analyze_network_security`
- `get_active_devices`
- `get_spectrum_data`
- `get_cell_towers`
- `query_signal_history`
- `get_map_state`

These are merged with framework tools and take precedence if there are naming conflicts.

## Troubleshooting

### Tools Not Showing in System Prompt

1. Check framework initialization: `isInitialized()` from `tool-execution/init`
2. Verify tools are registered: `GET /api/tools/scan`
3. Check server logs for detection errors

### Tool Execution Fails

1. Verify tool exists: `globalExecutor.hasTool('tool_name')`
2. Check tool is installed: `GET /api/tools/status/:toolId`
3. Test tool manually: `POST /api/tools/execute`
4. Check adapter logs for backend errors

### Agent Doesn't Use Tools

1. Verify tools are in system prompt (check LLM request)
2. Ensure tool invocation instructions are clear
3. For Ollama: Frontend must parse text responses for tool mentions
4. For Anthropic: Check tool_use content blocks in response

## Future Enhancements

### Planned Features

1. **Automatic Tool Invocation**: Parse Ollama responses and auto-execute tools
2. **Tool Result Feedback**: Send tool results back to LLM for multi-turn tool use
3. **Tool Categories**: Filter tools by namespace (wifi, bluetooth, cellular)
4. **Tool Permissions**: Role-based access control for sensitive tools
5. **Tool Monitoring**: Track tool usage and performance metrics

## Related Documentation

- [Tool Execution Framework README](../tool-execution/README.md)
- [Tool Detection System](../tool-execution/detection/README.md)
- [Backend Adapters](../tool-execution/adapters/README.md)
