#!/usr/bin/env tsx
/**
 * MCP Installation Script
 * Installs MCP configuration for Context B or C
 */

import {
	installContextBConfig,
	installContextCConfig,
	getInstallationInstructions
} from '../src/lib/server/mcp';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
	console.log('[MCP Install] Starting installation...\n');

	try {
		if (command === 'b' || command === 'host') {
			// Install for Context B (Host)
			const configPath = await installContextBConfig();
			console.log('\n✅ Context B (Host) configuration installed!');
			console.log(`   Location: ${configPath}`);
			console.log('\n📝 Next steps:');
			console.log('   1. Restart Claude CLI');
			console.log('   2. Test with: claude "List available Argos tools"');
		} else if (command === 'c' || command === 'container') {
			// Install for Context C (Container)
			const configPath = await installContextCConfig();
			console.log('\n✅ Context C (Container) configuration installed!');
			console.log(`   Location: ${configPath}`);
			console.log('\n📝 Next steps:');
			console.log('   1. Mount this directory in your container:');
			console.log(`      -v ${configPath.replace('/mcp.json', '')}:/root/.claude`);
			console.log('   2. Restart container Claude CLI');
		} else if (command === 'help' || !command) {
			console.log(getInstallationInstructions());
		} else {
			console.error(`❌ Unknown command: ${command}`);
			console.log('\nUsage:');
			console.log('  npm run mcp:install-b    # Install for Context B (host)');
			console.log('  npm run mcp:install-c    # Install for Context C (container)');
			process.exit(1);
		}
	} catch (error) {
		console.error('\n❌ Installation failed:', error);
		process.exit(1);
	}
}

main();
