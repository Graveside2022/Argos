# Auto-MCP Integration for Context B/C

Automatically generates and manages MCP (Model Context Protocol) servers that expose Argos tools and hardware to Claude CLI instances (Context B and C).

## How It Works

```
Tool Detection → Tool Registry ──┐
                                 ├─→ Dynamic MCP Server (auto-updates)
Hardware Detection → Hardware Registry ──┘              ↓
                                            Context B/C (Claude CLI)
                                            Sees all tools natively
```

### Real-Time Updates

```
1. New tool installed (e.g., Bluing Docker container)
       ↓
2. Tool detection finds it
       ↓
3. Registered in globalRegistry
       ↓
4. Registry emits 'tool_added' event
       ↓
5. MCP server refreshes tool list
       ↓
6. Context B/C immediately sees bluetooth_scan_bluing tool
```

```
1. Hardware connected (e.g., HackRF plugged in)
       ↓
2. Hardware detection finds it
       ↓
3. Registered in globalHardwareRegistry
       ↓
4. Registry emits 'hardware_added' event
       ↓
5. MCP server refreshes (tools requiring HackRF now available)
       ↓
6. Context B/C sees spectrum_sweep_hackrf tool
```

## Installation

### 1. Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk
```

### 2. Generate Configuration for Context B (Host)

```bash
# Generate and install to ~/.claude/mcp.json
npm run mcp:install-b

# Or just show the config
npm run mcp:config-b
```

### 3. Generate Configuration for Context C (Container)

```bash
# Generate and install to .claude-container/mcp.json
npm run mcp:install-c

# Or just show the config
npm run mcp:config-c
```

### 4. Start MCP Server

```bash
# Start standalone MCP server
npm run mcp:start

# Or start with Argos (auto-starts in hooks.server.ts)
npm run dev
```

## Configuration Files

### Context B (Host Claude CLI)

**Location:** `~/.claude/mcp.json`

```json
{
	"mcpServers": {
		"argos-tools": {
			"command": "npx",
			"args": ["tsx", "/path/to/src/lib/server/mcp/dynamic-server.ts"],
			"env": {
				"NODE_ENV": "development",
				"ARGOS_API_URL": "http://localhost:5173"
			}
		}
	}
}
```

### Context C (Container Claude CLI)

**Location:** `.claude-container/mcp.json`

```json
{
	"mcpServers": {
		"argos-tools": {
			"command": "node",
			"args": ["/app/build/server/mcp/dynamic-server.js"],
			"env": {
				"NODE_ENV": "production",
				"ARGOS_API_URL": "http://host.docker.internal:5173"
			}
		}
	}
}
```

## Usage

### From Context B (Host Claude CLI)

```bash
# Start Claude CLI
claude

# I (Claude) can now see all Argos tools
User: "What tools do you have for WiFi scanning?"

Claude: "I have access to these Argos WiFi tools:
- wifi_scan_kismet: Scan for WiFi networks using Kismet
- wifi_monitor_airodump: Monitor WiFi traffic with Airodump
- wifi_attack_wifite: Automated WiFi attack tool
..."

User: "Scan for WiFi networks"

Claude: [Calls wifi_scan_kismet tool via MCP]
```

### From Context C (Container Claude CLI)

Same as Context B, but running inside a Docker container with access to Argos tools.

## Dynamic MCP Server

### Features

✅ **Auto-Discovery**: Reads tools from globalRegistry
✅ **Real-Time Updates**: Refreshes when tools/hardware change
✅ **Hardware-Aware**: Only exposes tools for available hardware
✅ **Zero Configuration**: No manual tool definitions needed
✅ **MCP Compliant**: Follows Anthropic's Model Context Protocol

### Tool Exposure

The MCP server exposes:

1. **Tools**: All registered tools from globalRegistry
2. **Resources**: Hardware status, tool status, etc.
3. **Prompts**: (Future) Predefined workflows

### Tool Filtering

Tools are filtered based on hardware availability:

```typescript
// Tool requires HackRF
tool.hardwareRequirements = [
	{
		category: 'sdr',
		required: true
	}
];

// Only exposed if HackRF is connected
// Context B/C won't see it if hardware is missing
```

## Registry Integration

### Event System

```typescript
import { registryEvents } from '$lib/server/mcp';

// Listen for tool changes
registryEvents.on('tool_added', (event, toolId) => {
	console.log(`New tool available: ${toolId}`);
});

registryEvents.on('hardware_added', (event, hwId) => {
	console.log(`New hardware connected: ${hwId}`);
});
```

### Auto-Refresh

The MCP server automatically refreshes when:

- Tools are installed/uninstalled
- Hardware is connected/disconnected
- Registry is updated manually

## API Endpoints

The MCP server implements these MCP protocol methods:

### `tools/list`

Returns all available tools from registry.

**Response:**

```json
{
	"tools": [
		{
			"name": "wifi_scan_kismet",
			"description": "Scan for WiFi networks using Kismet",
			"inputSchema": {
				"type": "object",
				"properties": {
					"duration": { "type": "number" },
					"channels": { "type": "array" }
				},
				"required": []
			}
		}
	]
}
```

### `tools/call`

Executes a tool via globalExecutor.

**Request:**

```json
{
	"name": "wifi_scan_kismet",
	"arguments": {
		"duration": 30,
		"channels": [1, 6, 11]
	}
}
```

**Response:**

```json
{
	"content": [
		{
			"type": "text",
			"text": "{\n  \"networks\": [...]\n}"
		}
	]
}
```

### `resources/list`

Returns available resources (hardware status, logs, etc.).

**Response:**

```json
{
	"resources": [
		{
			"uri": "argos://hardware/status",
			"name": "Hardware Status",
			"mimeType": "application/json"
		},
		{
			"uri": "argos://hardware/hackrf-abc123",
			"name": "HackRF One",
			"description": "sdr - connected"
		}
	]
}
```

## Programmatic Usage

### Start MCP Server

```typescript
import { startArgosMCPServer, initializeMCPIntegration } from '$lib/server/mcp';

// Start server
const mcpServer = await startArgosMCPServer();

// Enable registry integration
initializeMCPIntegration(mcpServer);

// Server now auto-updates when tools/hardware change
```

### Generate Config

```typescript
import { generateContextBConfig, installContextBConfig } from '$lib/server/mcp';

// Generate config
const config = await generateContextBConfig();
console.log(JSON.stringify(config, null, 2));

// Install to ~/.claude/mcp.json
const path = await installContextBConfig();
console.log(`Installed to: ${path}`);
```

## Troubleshooting

### MCP Server Not Starting

1. Check MCP SDK is installed:

    ```bash
    npm list @modelcontextprotocol/sdk
    ```

2. Check server logs:

    ```bash
    npm run mcp:start
    # Look for errors
    ```

3. Verify tool registry is initialized:
    ```bash
    curl http://localhost:5173/api/tools/scan
    ```

### Claude CLI Not Seeing Tools

1. Check MCP config exists:

    ```bash
    cat ~/.claude/mcp.json
    ```

2. Restart Claude CLI

3. Check MCP server is running:

    ```bash
    ps aux | grep mcp
    ```

4. Test MCP connection:
    ```bash
    claude "List available tools"
    ```

### Tools Not Updating

1. Check registry events are enabled:

    ```typescript
    // Should be called in hooks.server.ts
    initializeMCPIntegration(mcpServer);
    ```

2. Manually refresh MCP server:

    ```typescript
    mcpServer.refresh();
    ```

3. Restart MCP server:
    ```bash
    # Kill existing server
    # Start new one
    npm run mcp:start
    ```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Tool Detection                         │
│   Docker, Binary, Service scanning                      │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│              Tool Registry                              │
│   Stores all detected tools                             │
│   Emits events on changes                               │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│          Dynamic MCP Server                             │
│   • Reads from tool registry                            │
│   • Listens for registry events                         │
│   • Auto-refreshes tool list                            │
│   • Exposes via MCP protocol                            │
└──────────────────┬──────────────────────────────────────┘
                   ↓
         ┌─────────┴─────────┐
         ↓                   ↓
┌─────────────────┐  ┌─────────────────┐
│   Context B     │  │   Context C     │
│  (Host Claude)  │  │ (Container CLI) │
│                 │  │                 │
│  ~/.claude/     │  │  /root/.claude/ │
│   mcp.json      │  │   mcp.json      │
└─────────────────┘  └─────────────────┘
```

## Benefits

✅ **Zero Manual Configuration**: Tools auto-exposed via MCP
✅ **Real-Time Updates**: New tools/hardware immediately available
✅ **Hardware-Aware**: Only shows tools for connected hardware
✅ **Native Integration**: Claude CLI sees tools natively
✅ **Standard Protocol**: Uses Anthropic's MCP standard
✅ **Multi-Context**: Same server for Context B and C

## Related Documentation

- [Tool Execution Framework](../agent/tool-execution/README.md)
- [Hardware Detection](../hardware/README.md)
- [Agent Integration](../agent/AGENT_INTEGRATION.md)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
