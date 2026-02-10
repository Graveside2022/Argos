/**
 * MCP Configuration Generator
 * Auto-generates MCP configs for Context B (host) and Context C (container)
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
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
 * Generate MCP configuration for Context C (Container Claude CLI)
 */
export async function generateContextCConfig(): Promise<MCPConfiguration> {
	const mcpServers: Record<string, MCPServerDefinition> = {};

	// Add all modular servers with container-adjusted URLs
	for (const server of MCP_SERVERS) {
		const serverDef = generateMCPServer(server.id, server.serverFile);
		// Container connects to host via host.docker.internal
		serverDef.env!.ARGOS_API_URL = 'http://host.docker.internal:5173';
		mcpServers[server.id] = serverDef;
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

	console.log(`[MCP Config] Written to: ${path}`);
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
 * Install MCP configuration for Context C (Container)
 */
export async function installContextCConfig(containerConfigDir?: string): Promise<string> {
	const config = await generateContextCConfig();

	// Default to project root .claude directory for container
	const configDir = containerConfigDir || join(process.cwd(), '.claude-container');
	const configPath = join(configDir, 'mcp.json');

	await writeMCPConfig(config, configPath);

	return configPath;
}

/**
 * Generate MCP configuration content (for display/testing)
 */
export async function generateMCPConfigContent(context: 'b' | 'c'): Promise<string> {
	const config =
		context === 'b' ? await generateContextBConfig() : await generateContextCConfig();

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

		console.log('[MCP Config] Updated existing configuration with all Argos MCP servers');
	} catch (_error) {
		// If file doesn't exist, create new one
		console.log('[MCP Config] Creating new configuration');
		const context = configPath.includes('container') ? 'c' : 'b';
		const config =
			context === 'b' ? await generateContextBConfig() : await generateContextCConfig();
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

## Context B (Host Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-b

2. Configuration will be written to:
   ~/.claude/mcp.json

3. Restart Claude CLI to load all 5 servers

4. Test with:
   claude "List available Argos tools"

## Context C (Container Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-c

2. Configuration will be written to:
   .claude-container/mcp.json

3. Mount this directory in your container:
   docker run -v $(pwd)/.claude-container:/root/.claude ...

4. Restart container Claude CLI

## Running Individual Servers (Development)

You can also run servers individually for testing:

npm run mcp:hackrf    # HackRF server only
npm run mcp:kismet    # Kismet server only
npm run mcp:gps       # GPS server only
npm run mcp:gsm-evil  # GSM Evil server only
npm run mcp:system    # System server only

## Manual Installation

Generate the config and copy it manually:

# Show config for Context B
npm run mcp:config-b

# Show config for Context C
npm run mcp:config-c

Then copy the output to ~/.claude/mcp.json
`;
}
