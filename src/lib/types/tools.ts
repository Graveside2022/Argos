/**
 * Type definitions for hierarchical tool navigation system
 */

import type { ActiveView } from '$lib/stores/dashboard/dashboard-store';

export type ToolStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export type DeploymentType = 'docker' | 'native' | 'external' | 'incompatible';

/**
 * Individual tool definition (leaf node in hierarchy)
 */
export interface ToolDefinition {
	id: string; // Unique identifier (e.g., 'kismet-wifi')
	name: string; // Display name
	description: string;
	icon: string; // SVG string

	// Installation metadata
	isInstalled: boolean;
	deployment: DeploymentType; // How it deploys

	// Integration
	viewName?: ActiveView; // For activeView routing (e.g., 'kismet')
	externalUrl?: string; // For external tools

	// Capabilities
	canOpen: boolean;
	shouldShowControls: boolean;
	requiresHardware?: string[]; // e.g., ['hackrf', 'gps']

	// Runtime state (managed separately in store)
	status?: ToolStatus;
	count?: number | null;

	// Callbacks
	onStart?: () => void | Promise<void>;
	onStop?: () => void | Promise<void>;
	onOpen?: () => void;
}

/**
 * Category in the tool hierarchy (branch node)
 */
export interface ToolCategory {
	id: string; // e.g., 'rf-spectrum'
	name: string; // Display name
	description?: string;
	icon?: string; // Category icon

	// Children can be subcategories or tools
	children: (ToolCategory | ToolDefinition)[];

	// Display options
	collapsible?: boolean; // Can collapse this section?
	defaultExpanded?: boolean; // Expanded by default?
}

/**
 * Root of the tool hierarchy
 */
export interface ToolHierarchy {
	root: ToolCategory; // Top-level category (OFFNET)
}

/**
 * Type guard to check if an item is a category (has children)
 */
export function isCategory(item: ToolCategory | ToolDefinition): item is ToolCategory {
	return 'children' in item;
}
