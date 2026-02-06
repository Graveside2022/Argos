/**
 * Example Tool Implementations
 * Demonstrates all backend types supported by the Tool Execution Framework
 */

import type { ToolDefinition } from '../types';

/**
 * Example 1: CLI Adapter - Docker Container Tool
 * Simulates a Bluetooth scanning tool running in Docker
 */
export const exampleDockerTool: ToolDefinition = {
	name: 'example.bluetooth.scan',
	namespace: 'example',
	description: 'Example Bluetooth scanner running in Docker container',
	backendType: 'cli',
	backendConfig: {
		command: 'docker',
		args: ['exec', '-i', 'argos-example-bluetooth', 'bluetoothctl', 'scan', 'on']
	},
	parameters: {
		duration: {
			type: 'number',
			description: 'Scan duration in seconds'
		}
	},
	requiredParameters: [],
	workflows: ['bluetooth_reconnaissance'],
	tags: ['bluetooth', 'scanning', 'docker', 'example']
};

/**
 * Example 2: CLI Adapter - Native Binary Tool
 * Simulates a network scanning tool using native binary
 */
export const exampleNativeTool: ToolDefinition = {
	name: 'example.network.ping',
	namespace: 'example',
	description: 'Example network ping tool using native binary',
	backendType: 'cli',
	backendConfig: {
		command: 'ping',
		args: ['-c', '4', '{{target}}']
	},
	parameters: {
		target: {
			type: 'string',
			description: 'Target IP address or hostname'
		}
	},
	requiredParameters: ['target'],
	workflows: ['network_diagnostics'],
	tags: ['network', 'ping', 'native', 'example']
};

/**
 * Example 3: HTTP Adapter - REST API Tool
 * Simulates querying a device database via REST API
 */
export const exampleHTTPTool: ToolDefinition = {
	name: 'example.device.lookup',
	namespace: 'example',
	description: 'Example device lookup via HTTP API',
	backendType: 'http',
	backendConfig: {
		baseUrl: 'http://localhost:2501',
		path: '/devices/by-key/{{device_key}}.json',
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	},
	parameters: {
		device_key: {
			type: 'string',
			description: 'Device key identifier'
		}
	},
	requiredParameters: ['device_key'],
	workflows: ['device_intelligence'],
	tags: ['http', 'api', 'devices', 'example']
};

/**
 * Example 4: WebSocket Adapter - Real-time Data Stream
 * Simulates subscribing to spectrum data stream
 */
export const exampleWebSocketTool: ToolDefinition = {
	name: 'example.spectrum.subscribe',
	namespace: 'example',
	description: 'Example spectrum data subscription via WebSocket',
	backendType: 'websocket',
	backendConfig: {
		url: 'ws://localhost:8080/spectrum',
		requestFormat: 'json',
		messageType: 'subscribe'
	},
	parameters: {
		frequency_mhz: {
			type: 'number',
			description: 'Center frequency in MHz'
		},
		bandwidth_mhz: {
			type: 'number',
			description: 'Bandwidth in MHz'
		}
	},
	requiredParameters: ['frequency_mhz', 'bandwidth_mhz'],
	workflows: ['spectrum_analysis'],
	tags: ['websocket', 'spectrum', 'realtime', 'example']
};

/**
 * Example 5: Internal Adapter - Built-in Handler
 * Simulates calculating distance between GPS coordinates
 */
export const exampleInternalTool: ToolDefinition = {
	name: 'example.geo.distance',
	namespace: 'example',
	description: 'Example geographic distance calculator (internal)',
	backendType: 'internal',
	backendConfig: {
		handler: 'calculateDistance'
	},
	parameters: {
		lat1: {
			type: 'number',
			description: 'Latitude of first point'
		},
		lon1: {
			type: 'number',
			description: 'Longitude of first point'
		},
		lat2: {
			type: 'number',
			description: 'Latitude of second point'
		},
		lon2: {
			type: 'number',
			description: 'Longitude of second point'
		}
	},
	requiredParameters: ['lat1', 'lon1', 'lat2', 'lon2'],
	workflows: ['geospatial_analysis'],
	tags: ['internal', 'geo', 'calculation', 'example']
};

/**
 * Example 6: MCP Adapter - Model Context Protocol Server
 * Simulates querying a specialized MCP server
 */
export const exampleMCPTool: ToolDefinition = {
	name: 'example.mcp.query',
	namespace: 'example',
	description: 'Example MCP server tool',
	backendType: 'mcp',
	backendConfig: {
		serverId: 'example-mcp-server',
		server: {
			command: 'node',
			args: ['example-mcp-server.js']
		},
		tools: ['query_data']
	},
	parameters: {
		query: {
			type: 'string',
			description: 'Query string'
		}
	},
	requiredParameters: ['query'],
	workflows: ['data_analysis'],
	tags: ['mcp', 'query', 'protocol', 'example']
};

/**
 * All example tools
 */
export const exampleTools: ToolDefinition[] = [
	exampleDockerTool,
	exampleNativeTool,
	exampleHTTPTool,
	exampleWebSocketTool,
	exampleInternalTool,
	exampleMCPTool
];

/**
 * Example internal handler for the internal adapter
 */
export async function handleCalculateDistance(params: {
	lat1: number;
	lon1: number;
	lat2: number;
	lon2: number;
}): Promise<{ distance_km: number; distance_miles: number }> {
	// Haversine formula for calculating distance between two GPS coordinates
	const R_km = 6371; // Earth's radius in kilometers
	const R_miles = 3959; // Earth's radius in miles

	const toRad = (deg: number) => (deg * Math.PI) / 180;

	const dLat = toRad(params.lat2 - params.lat1);
	const dLon = toRad(params.lon2 - params.lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(params.lat1)) *
			Math.cos(toRad(params.lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return {
		distance_km: R_km * c,
		distance_miles: R_miles * c
	};
}
