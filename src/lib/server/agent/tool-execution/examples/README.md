# Example Tool Implementations

This directory contains example tool implementations demonstrating all backend types supported by the Tool Execution Framework.

## Example Tools

### 1. CLI Adapter - Docker Container (`example.bluetooth.scan`)

```typescript
{
  backendType: 'cli',
  backendConfig: {
    command: 'docker',
    args: ['exec', '-i', 'argos-example-bluetooth', 'bluetoothctl', 'scan', 'on']
  }
}
```

**Demonstrates:** Running tools inside Docker containers

### 2. CLI Adapter - Native Binary (`example.network.ping`)

```typescript
{
  backendType: 'cli',
  backendConfig: {
    command: 'ping',
    args: ['-c', '4', '{{target}}']
  }
}
```

**Demonstrates:** Executing native system binaries

### 3. HTTP Adapter (`example.device.lookup`)

```typescript
{
  backendType: 'http',
  backendConfig: {
    baseUrl: 'http://localhost:2501',
    path: '/devices/by-key/{{device_key}}.json',
    method: 'GET'
  }
}
```

**Demonstrates:** Querying REST APIs

### 4. WebSocket Adapter (`example.spectrum.subscribe`)

```typescript
{
  backendType: 'websocket',
  backendConfig: {
    url: 'ws://localhost:8080/spectrum',
    requestFormat: 'json'
  }
}
```

**Demonstrates:** Real-time data streams

### 5. Internal Adapter (`example.geo.distance`)

```typescript
{
  backendType: 'internal',
  backendConfig: {
    handler: 'calculateDistance'
  }
}
```

**Demonstrates:** Built-in JavaScript handlers
**Implementation:** Haversine formula for GPS distance calculation

### 6. MCP Adapter (`example.mcp.query`)

```typescript
{
  backendType: 'mcp',
  backendConfig: {
    serverId: 'example-mcp-server',
    server: {
      command: 'node',
      args: ['example-mcp-server.js']
    }
  }
}
```

**Demonstrates:** Model Context Protocol server integration

## Usage in Tests

### Register Example Tools

```typescript
import { globalRegistry } from '$lib/server/agent/tool-execution';
import { exampleTools } from '$lib/server/agent/tool-execution/examples/example-tools';

// Register all example tools
exampleTools.forEach((tool) => {
	globalRegistry.register(tool);
});
```

### Register Internal Handler

```typescript
import { InternalAdapter } from '$lib/server/agent/tool-execution/adapters';
import { handleCalculateDistance } from '$lib/server/agent/tool-execution/examples/example-tools';

const internalAdapter = globalRouter['adapters'].find(
	(a) => a.backendType === 'internal'
) as InternalAdapter;

internalAdapter.registerHandler('calculateDistance', handleCalculateDistance);
```

### Execute Example Tool

```typescript
import { globalExecutor } from '$lib/server/agent/tool-execution';

const result = await globalExecutor.execute('example.geo.distance', {
	lat1: 40.7128,
	lon1: -74.006, // New York
	lat2: 34.0522,
	lon2: -118.2437 // Los Angeles
});

console.log(result.data);
// { distance_km: 3944.42, distance_miles: 2451.10 }
```

## Running Tests

### End-to-End Test

```bash
npm run test:e2e -- tool-execution-e2e.test.ts
```

### Performance Benchmark

```bash
npm run test:performance -- tool-execution-benchmark.test.ts
```

### Integration Test

```bash
npm run test:integration -- agent-tool-integration.test.ts
```

## Creating Your Own Example Tool

1. **Define the tool:**

```typescript
export const myExampleTool: ToolDefinition = {
	name: 'example.my.tool',
	namespace: 'example',
	description: 'My example tool',
	backendType: 'cli', // or 'http', 'websocket', 'mcp', 'internal'
	backendConfig: {
		// Backend-specific configuration
	},
	parameters: {
		param1: { type: 'string', description: 'Parameter description' }
	},
	requiredParameters: ['param1']
};
```

2. **Register the tool:**

```typescript
globalRegistry.register(myExampleTool);
```

3. **Execute the tool:**

```typescript
const result = await globalExecutor.execute('example.my.tool', {
	param1: 'value'
});
```

## Backend Type Selection Guide

| Backend Type  | Use When                                           |
| ------------- | -------------------------------------------------- |
| **CLI**       | Tool is a command-line binary (Docker or native)   |
| **HTTP**      | Tool provides a REST API endpoint                  |
| **WebSocket** | Tool streams real-time data                        |
| **MCP**       | Tool is a Model Context Protocol server            |
| **Internal**  | Tool logic is implemented in JavaScript/TypeScript |

## Example Tool Workflows

### Network Reconnaissance

```typescript
// Step 1: Ping target
await globalExecutor.execute('example.network.ping', {
	target: '192.168.1.1'
});

// Step 2: Lookup device details
await globalExecutor.execute('example.device.lookup', {
	device_key: 'DEVICE_123'
});
```

### Geospatial Analysis

```typescript
// Calculate distance between operator and target
const operatorPos = { lat: 40.7128, lon: -74.006 };
const targetPos = { lat: 34.0522, lon: -118.2437 };

const result = await globalExecutor.execute('example.geo.distance', {
	lat1: operatorPos.lat,
	lon1: operatorPos.lon,
	lat2: targetPos.lat,
	lon2: targetPos.lon
});

console.log(`Distance to target: ${result.data.distance_km.toFixed(2)} km`);
```

## Notes

- Example tools are for **testing and demonstration only**
- Most examples require external services (Docker, APIs) to be running
- Internal adapter examples work without external dependencies
- Use these as templates for implementing real tools
