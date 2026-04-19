#!/usr/bin/env tsx
/**
 * MCP Installation Script
 * Installs MCP configuration for the host Claude CLI
 */

import { config } from 'dotenv';
config();

import {
	getInstallationInstructions,
	installContextBConfig
} from '../../src/lib/server/mcp/config-generator';

const args = process.argv.slice(2);
const command = args[0] ?? '';

function validateEnv(): void {
	if (!process.env.ARGOS_API_KEY) {
		process.stderr.write('[WARN] ARGOS_API_KEY is empty — .env may be missing or incomplete\n');
	}
}

async function installHost(): Promise<void> {
	const configPath = await installContextBConfig();
	process.stdout.write('\n[OK] Host MCP configuration installed!\n');
	process.stdout.write(`   Location: ${configPath}\n`);
	process.stdout.write('\n[LOG] Next steps:\n');
	process.stdout.write('   1. Restart Claude CLI\n');
	process.stdout.write('   2. Test with: claude "List available Argos tools"\n');
}

function printHelp(): void {
	process.stdout.write(getInstallationInstructions() + '\n');
}

function printUnknownCommand(cmd: string): never {
	console.error(`[ERROR] Unknown command: ${cmd}`);
	process.stdout.write('\nUsage:\n');
	process.stdout.write('  npm run mcp:install-b    # Install MCP servers (host)\n');
	process.exit(1);
}

const COMMAND_HANDLERS: Record<string, () => Promise<void> | void> = {
	b: installHost,
	host: installHost,
	'': installHost,
	help: printHelp
};

async function main(): Promise<void> {
	validateEnv();
	process.stdout.write('[MCP Install] Starting installation...\n\n');
	try {
		const handler = COMMAND_HANDLERS[command];
		if (handler) {
			await handler();
			return;
		}
		printUnknownCommand(command);
	} catch (error) {
		console.error('\n[ERROR] Installation failed:', error);
		process.exit(1);
	}
}

main();
