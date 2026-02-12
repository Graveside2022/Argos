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
			console.log('# Context B (Host) MCP Configuration');
			console.log('# Save to: ~/.claude/mcp.json\n');
			console.log(config);
		} else if (command === 'c' || command === 'container') {
			// Show Context C config
			const config = await generateMCPConfigContent('c');
			console.log('# Context C (Container) MCP Configuration');
			console.log('# Save to: .claude-container/mcp.json\n');
			console.log(config);
		} else {
			console.error(`[ERROR] Unknown command: ${command}`);
			console.log('\nUsage:');
			console.log('  npm run mcp:config-b    # Show config for Context B (host)');
			console.log('  npm run mcp:config-c    # Show config for Context C (container)');
			process.exit(1);
		}
	} catch (error) {
		console.error('[ERROR] Error generating config:', error);
		process.exit(1);
	}
}

main();
