#!/usr/bin/env tsx
/**
 * MCP Installation Script
 * Installs MCP configuration for Context B or C
 */

import {
	getInstallationInstructions,
	installContextBConfig,
	installContextCConfig
} from '../src/lib/server/mcp';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	process.stdout.write('[MCP Install] Starting installation...\n\n');

	try {
		if (command === 'b' || command === 'host') {
			// Install for Context B (Host)
			const configPath = await installContextBConfig();
			process.stdout.write('\n[OK] Context B (Host) configuration installed!\n');
			process.stdout.write(`   Location: ${configPath}\n`);
			process.stdout.write('\n[LOG] Next steps:\n');
			process.stdout.write('   1. Restart Claude CLI\n');
			process.stdout.write('   2. Test with: claude "List available Argos tools"\n');
		} else if (command === 'c' || command === 'container') {
			// Install for Context C (Container)
			const configPath = await installContextCConfig();
			process.stdout.write('\n[OK] Context C (Container) configuration installed!\n');
			process.stdout.write(`   Location: ${configPath}\n`);
			process.stdout.write('\n[LOG] Next steps:\n');
			process.stdout.write('   1. Mount this directory in your container:\n');
			process.stdout.write(`      -v ${configPath.replace('/mcp.json', '')}:/root/.claude\n`);
			process.stdout.write('   2. Restart container Claude CLI\n');
		} else if (command === 'help' || !command) {
			process.stdout.write(getInstallationInstructions() + '\n');
		} else {
			console.error(`[ERROR] Unknown command: ${command}`);
			process.stdout.write('\nUsage:\n');
			process.stdout.write('  npm run mcp:install-b    # Install for Context B (host)\n');
			process.stdout.write(
				'  npm run mcp:install-c    # Install for Context C (container)\n'
			);
			process.exit(1);
		}
	} catch (error) {
		console.error('\n[ERROR] Installation failed:', error);
		process.exit(1);
	}
}

main();
