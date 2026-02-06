/**
 * Tool Execution Framework Initialization
 *
 * Initializes the tool execution framework on server startup:
 * - Registers backend adapters
 * - Scans for installed tools
 * - Auto-registers detected tools
 */

import { globalRouter } from './router';
import { globalExecutor } from './executor';
import { HTTPAdapter, CLIAdapter, InternalAdapter, MCPAdapter, WebSocketAdapter } from './adapters';
import { scanInstalledTools } from './detection';

let initialized = false;

/**
 * Initialize the tool execution framework
 * Should be called once on server startup
 */
export async function initializeToolExecutionFramework(): Promise<void> {
	if (initialized) {
		console.log('[ToolExecution] Already initialized, skipping');
		return;
	}

	console.log('[ToolExecution] Initializing tool execution framework...');

	try {
		// Step 1: Register backend adapters
		console.log('[ToolExecution] Registering backend adapters...');
		globalRouter.registerAdapter(new HTTPAdapter());
		globalRouter.registerAdapter(new CLIAdapter());
		globalRouter.registerAdapter(new InternalAdapter());
		globalRouter.registerAdapter(new MCPAdapter());
		globalRouter.registerAdapter(new WebSocketAdapter());

		// Step 2: Initialize all adapters
		console.log('[ToolExecution] Initializing adapters...');
		await globalExecutor.initialize();

		// Step 3: Scan system for installed tools
		console.log('[ToolExecution] Scanning for installed tools...');
		const scanResult = await scanInstalledTools();

		console.log('[ToolExecution] Initialization complete:');
		console.log(`  - Registered adapters: ${globalRouter.getStats().adapterCount}`);
		console.log(`  - Total tools in hierarchy: ${scanResult.stats.total}`);
		console.log(`  - Installed tools detected: ${scanResult.stats.installed}`);
		console.log(`  - Tools registered for execution: ${scanResult.registered.length}`);
		console.log(`    - Docker: ${scanResult.stats.docker}`);
		console.log(`    - Native: ${scanResult.stats.native}`);
		console.log(`    - Service: ${scanResult.stats.service}`);

		initialized = true;
	} catch (error) {
		console.error('[ToolExecution] Initialization failed:', error);
		throw error;
	}
}

/**
 * Check if framework is initialized
 */
export function isInitialized(): boolean {
	return initialized;
}

/**
 * Force re-scan of installed tools
 * Useful when tools are installed/uninstalled at runtime
 */
export async function rescanTools(): Promise<void> {
	if (!initialized) {
		throw new Error('Tool execution framework not initialized');
	}

	console.log('[ToolExecution] Re-scanning installed tools...');
	const scanResult = await scanInstalledTools();

	console.log('[ToolExecution] Re-scan complete:');
	console.log(`  - Installed tools: ${scanResult.stats.installed}/${scanResult.stats.total}`);
	console.log(`  - Newly registered: ${scanResult.registered.length}`);
}
