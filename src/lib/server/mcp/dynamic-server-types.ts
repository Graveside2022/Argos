/**
 * Shared type definitions for the dynamic MCP server tool modules.
 *
 * Provides interfaces used across dynamic-server-tools.ts,
 * dynamic-server-tools-system.ts, and dynamic-server.ts.
 */

/** Type definition for Kismet device data (dynamic properties from API) */
export interface KismetDevice {
	mac?: string;
	macaddr?: string;
	ssid?: string;
	name?: string;
	signalStrength?: number;
	signal?: {
		last_signal?: number;
	};
	manufacturer?: string;
	manuf?: string;
	type?: string;
	deviceType?: string;
	encryption?: string;
	crypt?: string;
	channel?: number;
	frequency?: number;
	packets?: number;
	dataPackets?: number;
	lastSeen?: string;
	last_time?: string;
	firstSeen?: string;
	first_time?: string;
	location?: unknown;
}

/** Shape of a tool scan entry returned by the /api/tools/scan endpoint */
export interface ToolScanEntry {
	installed: boolean;
	deployment?: string;
	binary?: {
		path?: string;
	};
	container?: {
		name?: string;
	};
	service?: {
		name?: string;
	};
}

/** Shape of an MCP tool definition with execute callback */
export interface ArgosTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
	execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Signature of the apiFetch helper passed to tool factory functions */
export type ApiFetchFn = (
	path: string,
	options?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<Response>;
