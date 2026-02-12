/**
 * Tools navigation store for hierarchical tool organization
 * Manages navigation state, expanded categories, and tool runtime status
 */

import { derived,writable } from 'svelte/store';

import { browser } from '$app/environment';
import { findByPath,toolHierarchy } from '$lib/data/tool-hierarchy';
import type { ToolStatus } from '$lib/types/tools';

// Validate stored path against current hierarchy (handles structure changes)
function getValidatedPath(): string[] {
	if (!browser) return [];
	let stored: string[] = [];
	try {
		stored = JSON.parse(localStorage.getItem('toolNavigationPath') || '[]');
	} catch (error) {
		console.warn(
			'[toolsStore] Corrupted toolNavigationPath in localStorage, using default',
			error
		);
		localStorage.removeItem('toolNavigationPath');
		return [];
	}
	if (stored.length === 0) return [];
	const result = findByPath(stored, toolHierarchy.root);
	if (result && 'children' in result) return stored;
	// Stale path from old hierarchy, reset
	localStorage.setItem('toolNavigationPath', '[]');
	return [];
}

// Navigation state: stack of category IDs representing the path
// Example: [] = root (TOOLS), ['offnet'] = OFFNET, ['offnet', 'recon'] = RECON
export const toolNavigationPath = writable<string[]>(getValidatedPath());

// Which categories are expanded (for collapsible sections)
function getExpandedCategories(): Set<string> {
	if (!browser) return new Set();
	try {
		return new Set(JSON.parse(localStorage.getItem('expandedCategories') || '[]'));
	} catch (error) {
		console.warn(
			'[toolsStore] Corrupted expandedCategories in localStorage, using default',
			error
		);
		localStorage.removeItem('expandedCategories');
		return new Set();
	}
}
export const expandedCategories = writable<Set<string>>(getExpandedCategories());

// Tool runtime states (overrides the static installed status)
// Maps tool ID to current status
export const toolStates = writable<Map<string, ToolStatus>>(new Map());

// Derived: current category being viewed
export const currentCategory = derived(toolNavigationPath, ($path) => {
	if ($path.length === 0) return toolHierarchy.root;
	const result = findByPath($path, toolHierarchy.root);
	if (result && 'children' in result) return result;
	// Invalid path — return root (navigateToCategory prevents this case)
	return toolHierarchy.root;
});

// Derived: breadcrumb trail for navigation header
export const breadcrumbs = derived(toolNavigationPath, ($path) => {
	const crumbs: string[] = ['TOOLS'];
	let current = toolHierarchy.root;

	for (const id of $path) {
		const found = current.children.find((child) => child.id === id);
		if (found && 'children' in found) {
			crumbs.push(found.name);
			current = found;
		}
	}

	return crumbs;
});

/**
 * Navigate to a specific category by ID.
 * Validates that the target path exists before committing.
 */
export function navigateToCategory(categoryId: string) {
	toolNavigationPath.update((path) => {
		const newPath = [...path, categoryId];
		const result = findByPath(newPath, toolHierarchy.root);
		// Only navigate if the target is a valid category with children
		if (result && 'children' in result) {
			return newPath;
		}
		// Invalid target — stay where we are
		return path;
	});
}

/**
 * Navigate back one level in the hierarchy
 */
export function navigateBack() {
	toolNavigationPath.update((path) => path.slice(0, -1));
}

/**
 * Navigate to the root level
 */
export function navigateToRoot() {
	toolNavigationPath.set([]);
}

/**
 * Toggle a category's expanded/collapsed state
 */
export function toggleCategory(categoryId: string) {
	expandedCategories.update((set) => {
		const newSet = new Set(set);
		if (newSet.has(categoryId)) {
			newSet.delete(categoryId);
		} else {
			newSet.add(categoryId);
		}
		return newSet;
	});
}

/**
 * Update a tool's runtime status
 */
export function setToolStatus(toolId: string, status: ToolStatus) {
	toolStates.update((map) => {
		const newMap = new Map(map);
		newMap.set(toolId, status);
		return newMap;
	});
}

/**
 * Get a tool's current status (from runtime state or static definition)
 */
export function getToolStatus(toolId: string): ToolStatus {
	let status: ToolStatus = 'stopped';
	toolStates.subscribe((map) => {
		status = map.get(toolId) || 'stopped';
	})();
	return status;
}

// Persistence to localStorage
if (browser) {
	toolNavigationPath.subscribe((path) => {
		localStorage.setItem('toolNavigationPath', JSON.stringify(path));
	});

	expandedCategories.subscribe((set) => {
		localStorage.setItem('expandedCategories', JSON.stringify([...set]));
	});
}
