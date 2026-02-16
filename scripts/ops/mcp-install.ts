#!/usr/bin/env tsx
/**
 * MCP Installation Script
 * Installs MCP configuration for the host Claude CLI
 */

import { getInstallationInstructions, installContextBConfig } from '../src/lib/server/mcp';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	process.stdout.write('[MCP Install] Starting installation...\n\n');

	try {
		if (command === 'b' || command === 'host' || !command) {
			const configPath = await installContextBConfig();
			process.stdout.write('\n[OK] Host MCP configuration installed!\n');
			process.stdout.write(`   Location: ${configPath}\n`);
			process.stdout.write('\n[LOG] Next steps:\n');
			process.stdout.write('   1. Restart Claude CLI\n');
			process.stdout.write('   2. Test with: claude "List available Argos tools"\n');
		} else if (command === 'help') {
			process.stdout.write(getInstallationInstructions() + '\n');
		} else {
			console.error(`[ERROR] Unknown command: ${command}`);
			process.stdout.write('\nUsage:\n');
			process.stdout.write('  npm run mcp:install-b    # Install MCP servers (host)\n');
			process.exit(1);
		}
	} catch (error) {
		console.error('\n[ERROR] Installation failed:', error);
		process.exit(1);
	}
}

main();
