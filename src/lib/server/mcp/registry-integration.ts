/**
 * Registry Integration for MCP
 * Automatically updates MCP server when tools or hardware change
 */

import type { RegistryChangeEvent, RegistryChangeListener } from './types';

/**
 * Registry event emitter
 */
class RegistryEventEmitter {
	private listeners: Map<RegistryChangeEvent, Set<RegistryChangeListener>> = new Map();

	/**
	 * Add event listener
	 */
	on(event: RegistryChangeEvent, listener: RegistryChangeListener): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
	}

	/**
	 * Remove event listener
	 */
	off(event: RegistryChangeEvent, listener: RegistryChangeListener): void {
		this.listeners.get(event)?.delete(listener);
	}

	/**
	 * Emit event
	 */
	emit(event: RegistryChangeEvent, id: string): void {
		const listeners = this.listeners.get(event);
		if (listeners) {
			for (const listener of listeners) {
				try {
					listener(event, id);
				} catch (error) {
					console.error(`[RegistryEvents] Listener error:`, error);
				}
			}
		}
	}
}

// Global event emitter
export const registryEvents = new RegistryEventEmitter();

/**
 * Wrap tool registry to emit events
 */
export function enableToolRegistryEvents(): void {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { globalRegistry } = require('../agent/tool-execution');

	// Wrap register method
	const originalRegister = globalRegistry.register.bind(globalRegistry);
	globalRegistry.register = function (tool: any) {
		originalRegister(tool);
		registryEvents.emit('tool_added', tool.name);
		console.log(`[RegistryEvents] Tool added: ${tool.name}`);
	};

	// Wrap unregister method
	const originalUnregister = globalRegistry.unregister.bind(globalRegistry);
	globalRegistry.unregister = function (name: string) {
		const result = originalUnregister(name);
		if (result) {
			registryEvents.emit('tool_removed', name);
			console.log(`[RegistryEvents] Tool removed: ${name}`);
		}
		return result;
	};

	console.log('[RegistryEvents] Tool registry events enabled');
}

/**
 * Wrap hardware registry to emit events
 */
export function enableHardwareRegistryEvents(): void {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { globalHardwareRegistry } = require('../hardware');

	// Wrap register method
	const originalRegister = globalHardwareRegistry.register.bind(globalHardwareRegistry);
	globalHardwareRegistry.register = function (hardware: any) {
		originalRegister(hardware);
		registryEvents.emit('hardware_added', hardware.id);
		console.log(`[RegistryEvents] Hardware added: ${hardware.name}`);
	};

	// Wrap unregister method
	const originalUnregister = globalHardwareRegistry.unregister.bind(globalHardwareRegistry);
	globalHardwareRegistry.unregister = function (id: string) {
		const result = originalUnregister(id);
		if (result) {
			registryEvents.emit('hardware_removed', id);
			console.log(`[RegistryEvents] Hardware removed: ${id}`);
		}
		return result;
	};

	console.log('[RegistryEvents] Hardware registry events enabled');
}

/**
 * Setup MCP server to listen for registry changes
 */
export function setupMCPRegistryListeners(mcpServer: any): void {
	// Refresh MCP server when tools change
	registryEvents.on('tool_added', (event, id) => {
		console.log(`[MCP Integration] Tool added, refreshing MCP server: ${id}`);
		mcpServer.refresh();
	});

	registryEvents.on('tool_removed', (event, id) => {
		console.log(`[MCP Integration] Tool removed, refreshing MCP server: ${id}`);
		mcpServer.refresh();
	});

	// Refresh MCP server when hardware changes (affects available tools)
	registryEvents.on('hardware_added', (event, id) => {
		console.log(`[MCP Integration] Hardware added, refreshing MCP server: ${id}`);
		mcpServer.refresh();
	});

	registryEvents.on('hardware_removed', (event, id) => {
		console.log(`[MCP Integration] Hardware removed, refreshing MCP server: ${id}`);
		mcpServer.refresh();
	});

	console.log('[MCP Integration] Registry listeners configured');
}

/**
 * Initialize full MCP integration
 */
export function initializeMCPIntegration(mcpServer: any): void {
	console.log('[MCP Integration] Initializing...');

	// Enable registry events
	enableToolRegistryEvents();
	enableHardwareRegistryEvents();

	// Setup MCP listeners
	setupMCPRegistryListeners(mcpServer);

	console.log('[MCP Integration] Initialization complete');
}
