/**
 * MCP Configuration Generator
 * Auto-generates MCP configs for the host Claude CLI
 */

import { mkdir, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

import type { MCPConfiguration, MCPServerDefinition } from './types';

/**
 * MCP server definitions for each specialized server
 */
const MCP_SERVERS = [
	{
		id: 'argos-hackrf',
		name: 'HackRF SDR Control',
		serverFile: 'hackrf-server.ts'
	},
	{
		id: 'argos-kismet',
		name: 'WiFi Scanning & Device Tracking',
		serverFile: 'kismet-server.ts'
	},
	{
		id: 'argos-gps',
		name: 'GPS Positioning & Location',
		serverFile: 'gps-server.ts'
	},
	{
		id: 'argos-gsm-evil',
		name: 'GSM Monitoring & IMSI Detection',
		serverFile: 'gsm-evil-server.ts'
	},
	{
		id: 'argos-system',
		name: 'System Stats & Hardware Scanning',
		serverFile: 'system-server.ts'
	}
] as const;

/**
 * Get path to MCP server executable
 */
function getMCPServerPath(serverFile: string): string {
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev) {
		return join(process.cwd(), 'src/lib/server/mcp/servers', serverFile);
	} else {
		return join(process.cwd(), 'build/server/mcp/servers', serverFile.replace('.ts', '.js'));
	}
}

/**
 * Generate MCP server definition
 */
export function generateMCPServer(serverId: string, serverFile: string): MCPServerDefinition {
	const serverPath = getMCPServerPath(serverFile);
	const isDev = process.env.NODE_ENV !== 'production';

	return {
		id: serverId,
		command: isDev ? 'npx' : 'node',
		args: isDev ? ['tsx', serverPath] : [serverPath],
		env: {
			NODE_ENV: process.env.NODE_ENV || 'development',
			ARGOS_API_URL: process.env.PUBLIC_ARGOS_API_URL || 'http://localhost:5173',
			ARGOS_API_KEY: process.env.ARGOS_API_KEY || ''
		}
	};
}

/**
 * Generate MCP server definition for legacy monolithic server (backward compat)
 */
export function generateArgosMCPServer(): MCPServerDefinition {
	const serverPath = join(
		process.cwd(),
		process.env.NODE_ENV !== 'production'
			? 'src/lib/server/mcp/dynamic-server.ts'
			: 'build/server/mcp/dynamic-server.js'
	);
	const isDev = process.env.NODE_ENV !== 'production';

	return {
		id: 'argos-tools',
		command: isDev ? 'npx' : 'node',
		args: isDev ? ['tsx', serverPath] : [serverPath],
		env: {
			NODE_ENV: process.env.NODE_ENV || 'development',
			ARGOS_API_URL: process.env.PUBLIC_ARGOS_API_URL || 'http://localhost:5173',
			ARGOS_API_KEY: process.env.ARGOS_API_KEY || ''
		}
	};
}

/**
 * Generate MCP configuration for Context B (Host Claude CLI)
 */
export async function generateContextBConfig(): Promise<MCPConfiguration> {
	const mcpServers: Record<string, MCPServerDefinition> = {};

	// Add all modular servers
	for (const server of MCP_SERVERS) {
		mcpServers[server.id] = generateMCPServer(server.id, server.serverFile);
	}

	return { mcpServers };
}

/**
 * Write MCP configuration to file
 */
async function writeMCPConfig(config: MCPConfiguration, path: string): Promise<void> {
	// Ensure directory exists
	const dir = join(path, '..');
	await mkdir(dir, { recursive: true });

	// Write config file
	await writeFile(path, JSON.stringify(config, null, 2), 'utf-8');

	console.warn(`[MCP Config] Written to: ${path}`);
}

/**
 * Install MCP configuration for Context B (Host)
 */
export async function installContextBConfig(): Promise<string> {
	const config = await generateContextBConfig();
	const configPath = join(homedir(), '.claude', 'mcp.json');

	await writeMCPConfig(config, configPath);

	return configPath;
}

/**
 * Generate MCP configuration content (for display/testing)
 */
export async function generateMCPConfigContent(): Promise<string> {
	const config = await generateContextBConfig();
	return JSON.stringify(config, null, 2);
}

/**
 * Update existing MCP configuration
 * Merges Argos servers with existing servers
 */
export async function updateExistingConfig(configPath: string): Promise<void> {
	try {
		// Read existing config
		const { readFile } = await import('fs/promises');
		const existingContent = await readFile(configPath, 'utf-8');
		const existingConfig: MCPConfiguration = JSON.parse(existingContent);

		// Add/update all Argos servers
		for (const server of MCP_SERVERS) {
			const serverDef = generateMCPServer(server.id, server.serverFile);
			existingConfig.mcpServers[server.id] = serverDef;
		}

		// Write back
		await writeMCPConfig(existingConfig, configPath);

		console.warn('[MCP Config] Updated existing configuration with all Argos MCP servers');
	} catch (_error) {
		// If file doesn't exist, create new one
		console.warn('[MCP Config] Creating new configuration');
		const config = await generateContextBConfig();
		await writeMCPConfig(config, configPath);
	}
}

/**
 * Generate installation instructions
 */
export function getInstallationInstructions(): string {
	return `
# Argos MCP Servers Installation

## Available Servers

The Argos platform provides 5 specialized MCP servers:

1. **argos-hackrf** - HackRF SDR control and spectrum analysis
2. **argos-kismet** - WiFi scanning and device tracking
3. **argos-gps** - GPS positioning and location services
4. **argos-gsm-evil** - GSM monitoring and IMSI detection
5. **argos-system** - System stats, hardware scanning, diagnostics

## Installation (Host Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-b

2. Configuration will be written to:
   ~/.claude/mcp.json

3. Restart Claude CLI to load all 5 servers

4. Test with:
   claude "List available Argos tools"

## Running Individual Servers (Development)

You can also run servers individually for testing:

npm run mcp:hackrf    # HackRF server only
npm run mcp:kismet    # Kismet server only
npm run mcp:gps       # GPS server only
npm run mcp:gsm-evil  # GSM Evil server only
npm run mcp:system    # System server only

## Manual Installation

Generate the config and copy it manually:

npm run mcp:config-b

Then copy the output to ~/.claude/mcp.json
`;
}
