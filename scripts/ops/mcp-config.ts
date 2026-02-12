#!/usr/bin/env tsx
/**
 * MCP Configuration Display Script
 * Shows MCP configuration for Context B or C
 */

import { generateMCPConfigContent } from '../src/lib/server/mcp';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	try {
		if (command === 'b' || command === 'host') {
			// Show Context B config
			const config = await generateMCPConfigContent('b');
			process.stdout.write('# Context B (Host) MCP Configuration\n');
			process.stdout.write('# Save to: ~/.claude/mcp.json\n\n');
			process.stdout.write(config + '\n');
		} else if (command === 'c' || command === 'container') {
			// Show Context C config
			const config = await generateMCPConfigContent('c');
			process.stdout.write('# Context C (Container) MCP Configuration\n');
			process.stdout.write('# Save to: .claude-container/mcp.json\n\n');
			process.stdout.write(config + '\n');
		} else {
			console.error(`[ERROR] Unknown command: ${command}`);
			process.stdout.write('\nUsage:\n');
			process.stdout.write('  npm run mcp:config-b    # Show config for Context B (host)\n');
			process.stdout.write(
				'  npm run mcp:config-c    # Show config for Context C (container)\n'
			);
			process.exit(1);
		}
	} catch (error) {
		console.error('[ERROR] Error generating config:', error);
		process.exit(1);
	}
}

main();
