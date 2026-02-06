# Tool Execution Framework

Unified tool execution layer that auto-detects installed tools and provides a consistent API for executing them across multiple backend types.

## Architecture

### Components

```
tool-execution/
├── types.ts              # TypeScript type definitions
├── registry.ts           # Tool registry with namespace organization
├── router.ts             # Routes tool calls to backend adapters
├── executor.ts           # High-level execution API
├── init.ts               # Initialization and startup logic
├── adapters/             # Backend adapters
│   ├── http-adapter.ts   # REST API execution
│   ├── cli-adapter.ts    # Command-line tool execution
│   ├── mcp-adapter.ts    # Model Context Protocol
│   ├── websocket-adapter.ts  # WebSocket services
│   └── internal-adapter.ts   # Built-in handlers
└── detection/            # Auto-detection system
    ├── docker-detector.ts    # Docker container detection
    ├── binary-detector.ts    # Native binary detection
    ├── service-detector.ts   # SystemD service detection
    ├── tool-mapper.ts        # Maps UI tools → Exec tools
    └── detector.ts           # Main orchestrator
```

### How It Works

1. **Server Startup** (`hooks.server.ts`)
    - `initializeToolExecutionFramework()` is called
    - Backend adapters are registered (HTTP, CLI, MCP, WebSocket, Internal)
    - System scan detects all installed tools

2. **Tool Detection** (`detection/`)
    - Scans for Docker containers (`docker ps -a`)
    - Checks for native binaries (`which <tool>`, common paths)
    - Queries SystemD services (`systemctl`)
    - Maps detected tools to execution definitions

3. **Auto-Registration**
    - Detected tools are converted to `ToolDefinition` objects
    - Backend configurations are generated (CLI commands, Docker exec, etc.)
    - Tools are registered in the global registry

4. **Execution** (`executor.ts`)
    - Agent calls `globalExecutor.execute(toolName, params)`
    - Router finds the appropriate backend adapter
    - Adapter executes the tool
    - Result is returned in standardized format

## Supported Backend Types

### CLI Adapter

Execute command-line tools (native or Docker):

```typescript
{
  backendType: 'cli',
  backendConfig: {
    command: 'docker',
    args: ['exec', '-i', 'argos-bluing', 'bluing', '{{target}}']
  }
}
```

### HTTP Adapter

Call REST APIs:

```typescript
{
  backendType: 'http',
  backendConfig: {
    baseUrl: 'http://localhost:2501',
    path: '/devices/{deviceId}',
    method: 'GET'
  }
}
```

### MCP Adapter

Connect to Model Context Protocol servers:

```typescript
{
  backendType: 'mcp',
  backendConfig: {
    serverId: 'kismet-server',
    server: { command: 'node', args: ['kismet-mcp.js'] }
  }
}
```

### WebSocket Adapter

Real-time data streams:

```typescript
{
  backendType: 'websocket',
  backendConfig: {
    url: 'ws://localhost:8080/spectrum',
    requestFormat: 'json'
  }
}
```

### Internal Adapter

Built-in JavaScript handlers:

```typescript
{
  backendType: 'internal',
  backendConfig: {
    handler: 'getDeviceDetails'
  }
}
```

## API Endpoints

### `GET /api/tools/scan`

Scan system and return installation status of all tools.

Response:

```json
{
	"success": true,
	"stats": {
		"total": 91,
		"installed": 23,
		"docker": 15,
		"native": 8,
		"service": 0
	},
	"tools": {
		"bluing": {
			"installed": true,
			"deployment": "docker",
			"container": {
				"name": "argos-bluing",
				"status": "running"
			}
		}
	}
}
```

### `GET /api/tools/status/:toolId`

Check if a specific tool is installed.

### `POST /api/tools/execute`

Execute a tool through the framework.

Request:

```json
{
	"toolName": "bluetooth.recon.bluing",
	"parameters": {
		"target": "AA:BB:CC:DD:EE:FF"
	},
	"context": {
		"workflow": "bluetooth_investigation"
	}
}
```

Response:

```json
{
  "success": true,
  "result": {
    "status": "success",
    "toolName": "bluetooth.recon.bluing",
    "data": { ... },
    "duration": 2340,
    "backend": "cli"
  }
}
```

## Usage Examples

### Execute a Tool

```typescript
import { globalExecutor } from '$lib/server/agent/tool-execution';

const result = await globalExecutor.execute('bluetooth.recon.bluing', {
	target: 'AA:BB:CC:DD:EE:FF'
});

if (result.status === 'success') {
	console.log('Tool output:', result.data);
}
```

### Query Available Tools

```typescript
import { globalRegistry } from '$lib/server/agent/tool-execution';

// Get all WiFi tools
const wifiTools = globalRegistry.query({ namespace: 'wifi' });

// Get tools for a specific workflow
const reconTools = globalRegistry.query({ workflow: 'reconnaissance' });

// Search by keyword
const bluetoothTools = globalRegistry.query({ search: 'bluetooth' });
```

### Check Installation Status

```typescript
import { isToolInstalled } from '$lib/server/agent/tool-execution';

const installed = await isToolInstalled('bluing');
if (installed) {
	console.log('Bluing is ready to use');
}
```

### Batch Execution

```typescript
import { globalExecutor } from '$lib/server/agent/tool-execution';

// Execute multiple tools in parallel
const results = await globalExecutor.executeBatch([
	{ toolName: 'wifi.recon.kismet', parameters: {} },
	{ toolName: 'bluetooth.recon.bluing', parameters: {} }
]);
```

## Tool Detection Rules

### Docker Containers

- Looks for containers with name pattern: `argos-{toolId}`
- Example: Tool ID `bluing` → Container `argos-bluing`
- Executes via: `docker exec -i argos-bluing bluing <args>`

### Native Binaries

- Checks PATH: `which <binaryName>`
- Checks common paths:
    - `/usr/bin/<tool>`
    - `/usr/local/bin/<tool>`
    - `/opt/<tool>/bin/<tool>`
- Executes via: `<binaryPath> <args>`

### SystemD Services

- Queries: `systemctl show <serviceName>.service`
- Useful for tools that run as background services
- Can check status, start/stop services

## Namespace Organization

Tools are organized into namespaces for easy filtering:

- `wifi.*` - WiFi tools (Kismet, Wifite, etc.)
- `bluetooth.*` - Bluetooth tools (Bluing, Bluesnarfer, etc.)
- `cellular.*` - Cellular tools (GSM Evil, gr-gsm, etc.)
- `spectrum.*` - Spectrum analysis tools (HackRF, OpenWebRX, etc.)
- `network.*` - Network tools (Bettercap, Ettercap, etc.)
- `drone.*` - Drone tools (DroneID, DroneSploit, etc.)
- `iot.*` - IoT tools (RTL-433, Zigator, etc.)

## Adding New Tools

### Automatic Detection

Tools added to `toolHierarchy.ts` are automatically detected if:

1. They follow naming conventions (Docker: `argos-{toolId}`)
2. Binary name matches tool ID or is mapped in `tool-mapper.ts`
3. Tool is actually installed on the system

### Manual Registration

```typescript
import { globalRegistry } from '$lib/server/agent/tool-execution';

globalRegistry.register({
	name: 'custom.tool',
	namespace: 'custom',
	description: 'My custom tool',
	backendType: 'cli',
	backendConfig: {
		type: 'cli',
		command: '/path/to/tool',
		args: ['{{param}}']
	},
	parameters: {
		param: { type: 'string', description: 'Tool parameter' }
	},
	requiredParameters: ['param']
});
```

## Troubleshooting

### Tool Not Detected

1. Check tool is in `toolHierarchy.ts`
2. Verify installation: `docker ps -a` or `which <tool>`
3. Check naming convention (Docker: `argos-{toolId}`)
4. Look at server logs for detection failures

### Tool Execution Fails

1. Check tool is registered: `GET /api/tools/execute`
2. Verify permissions (Docker exec, binary executable)
3. Check logs for adapter errors
4. Test tool manually: `docker exec argos-bluing bluing --help`

### Re-scan Tools

```typescript
import { rescanTools } from '$lib/server/agent/tool-execution/init';

// After installing a new tool
await rescanTools();
```

Or via API:

```bash
curl -X POST http://localhost:5173/api/tools/scan
```
