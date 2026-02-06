/**
 * MCP Configuration Generator
 * Auto-generates MCP configs for Context B (host) and Context C (container)
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { MCPConfiguration, MCPServerDefinition } from './types';

/**
 * Get path to Argos MCP server executable
 */
function getArgosMCPServerPath(): string {
	// In development, use the TypeScript file via tsx
	// In production, use compiled JavaScript
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev) {
		return join(process.cwd(), 'src/lib/server/mcp/dynamic-server.ts');
	} else {
		return join(process.cwd(), 'build/server/mcp/dynamic-server.js');
	}
}

/**
 * Generate MCP server definition for Argos
 */
export function generateArgosMCPServer(): MCPServerDefinition {
	const serverPath = getArgosMCPServerPath();
	const isDev = process.env.NODE_ENV !== 'production';

	return {
		id: 'argos-tools',
		command: isDev ? 'npx' : 'node',
		args: isDev ? ['tsx', serverPath] : [serverPath],
		env: {
			NODE_ENV: process.env.NODE_ENV || 'development',
			ARGOS_API_URL: process.env.PUBLIC_ARGOS_API_URL || 'http://localhost:5173'
		}
	};
}

/**
 * Generate MCP configuration for Context B (Host Claude CLI)
 */
export async function generateContextBConfig(): Promise<MCPConfiguration> {
	const argoServer = generateArgosMCPServer();

	const config: MCPConfiguration = {
		mcpServers: {
			'argos-tools': argoServer
		}
	};

	return config;
}

/**
 * Generate MCP configuration for Context C (Container Claude CLI)
 */
export async function generateContextCConfig(): Promise<MCPConfiguration> {
	const argoServer = generateArgosMCPServer();

	// Adjust URLs for container environment
	argoServer.env!.ARGOS_API_URL = 'http://host.docker.internal:5173';

	const config: MCPConfiguration = {
		mcpServers: {
			'argos-tools': argoServer
		}
	};

	return config;
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
 * Merges Argos server with existing servers
 */
export async function updateExistingConfig(configPath: string): Promise<void> {
	try {
		// Read existing config
		const { readFile } = await import('fs/promises');
		const existingContent = await readFile(configPath, 'utf-8');
		const existingConfig: MCPConfiguration = JSON.parse(existingContent);

		// Add/update Argos server
		const argoServer = generateArgosMCPServer();
		existingConfig.mcpServers['argos-tools'] = argoServer;

		// Write back
		await writeMCPConfig(existingConfig, configPath);

		console.log('[MCP Config] Updated existing configuration');
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
# MCP Configuration Installation

## Context B (Host Claude CLI)

1. Generate and install configuration:
   npm run mcp:install-b

2. Configuration will be written to:
   ~/.claude/mcp.json

3. Restart Claude CLI to load the configuration

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

## Manual Installation

You can also generate the config and copy it manually:

# Show config for Context B
npm run mcp:config-b

# Show config for Context C
npm run mcp:config-c

Then copy the output to ~/.claude/mcp.json
`;
}
