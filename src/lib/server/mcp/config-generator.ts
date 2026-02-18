/**
 * MCP Configuration Generator
 * Auto-generates MCP configs for the host Claude CLI
 */

import { config } from 'dotenv';
config();

import { writeFile } from 'fs/promises';
import { join } from 'path';

import type { MCPConfiguration, MCPServerDefinition } from './types';

/**
 * MCP server definitions for each specialized server
 */
const MCP_SERVERS = [
	{
		id: 'argos-hardware-debugger',
		name: 'Hardware Diagnostics & Recovery',
		serverFile: 'hardware-debugger.ts'
	},
	{
		id: 'argos-system-inspector',
		name: 'System Health & Docker Status',
		serverFile: 'system-inspector.ts'
	},
	{
		id: 'argos-streaming-inspector',
		name: 'SSE Stream Monitoring',
		serverFile: 'streaming-inspector.ts'
	},
	{
		id: 'argos-database-inspector',
		name: 'Database Schema & Queries',
		serverFile: 'database-inspector.ts'
	},
	{
		id: 'argos-api-debugger',
		name: 'API Endpoint Testing',
		serverFile: 'api-debugger.ts'
	},
	{
		id: 'argos-test-runner',
		name: 'Test Suite Runner',
		serverFile: 'test-runner.ts'
	},
	{
		id: 'argos-gsm-evil',
		name: 'GSM Monitoring & IMSI Detection',
		serverFile: 'gsm-evil-server.ts'
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
async function writeMCPConfig(mcpConfig: MCPConfiguration, path: string): Promise<void> {
	await writeFile(path, JSON.stringify(mcpConfig, null, '\t') + '\n', 'utf-8');
	console.warn(`[MCP Config] Written to: ${path}`);
}

/**
 * Install MCP configuration for Context B (Host)
 * Writes to .mcp.json in the project root (where Claude Code reads it)
 */
export async function installContextBConfig(): Promise<string> {
	const mcpConfig = await generateContextBConfig();

	// Add shadcn (no env needed)
	mcpConfig.mcpServers['shadcn'] = {
		id: 'shadcn',
		command: 'npx',
		args: ['shadcn@latest', 'mcp']
	};

	const configPath = join(process.cwd(), '.mcp.json');
	await writeMCPConfig(mcpConfig, configPath);

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

The Argos platform provides 7 specialized MCP servers:

1. **argos-hardware-debugger** - Hardware diagnostics and recovery
2. **argos-system-inspector** - System health and Docker status
3. **argos-streaming-inspector** - SSE stream monitoring
4. **argos-database-inspector** - Database schema and queries
5. **argos-api-debugger** - API endpoint testing
6. **argos-test-runner** - Test suite runner
7. **argos-gsm-evil** - GSM monitoring and IMSI detection

## Installation (Host Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-b

2. Configuration will be written to:
   .mcp.json (project root)

3. Restart Claude CLI to load all servers

4. Test with:
   claude "List available Argos tools"
`;
}
