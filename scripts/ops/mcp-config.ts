#!/usr/bin/env tsx
/**
 * MCP Configuration Display Script
 * Shows MCP configuration for the host Claude CLI
 */

import { generateMCPConfigContent } from '../src/lib/server/mcp';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	try {
		if (command === 'b' || command === 'host' || !command) {
			const config = await generateMCPConfigContent();
			process.stdout.write('# Host MCP Configuration\n');
			process.stdout.write('# Save to: ~/.claude/mcp.json\n\n');
			process.stdout.write(config + '\n');
		} else {
			console.error(`[ERROR] Unknown command: ${command}`);
			process.stdout.write('\nUsage:\n');
			process.stdout.write('  npm run mcp:config-b    # Show MCP config (host)\n');
			process.exit(1);
		}
	} catch (error) {
		console.error('[ERROR] Error generating config:', error);
		process.exit(1);
	}
}

main();
