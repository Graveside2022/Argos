/**
 * Tools navigation store for hierarchical tool organization
 * Manages navigation state, expanded categories, and tool runtime status
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { ToolStatus } from '$lib/types/tools';
import { toolHierarchy, findByPath } from '$lib/data/toolHierarchy';

// Navigation state: stack of category IDs representing the path
// Example: [] = root (OFFNET), ['rf-spectrum'] = RF & SPECTRUM, ['rf-spectrum', 'bluetooth'] = Bluetooth
export const toolNavigationPath = writable<string[]>(
	browser ? JSON.parse(localStorage.getItem('toolNavigationPath') || '[]') : []
);

// Which categories are expanded (for collapsible sections)
export const expandedCategories = writable<Set<string>>(
	browser ? new Set(JSON.parse(localStorage.getItem('expandedCategories') || '[]')) : new Set()
);

// Tool runtime states (overrides the static installed status)
// Maps tool ID to current status
export const toolStates = writable<Map<string, ToolStatus>>(new Map());

// Derived: current category being viewed
export const currentCategory = derived(toolNavigationPath, ($path) => {
	const result = findByPath($path, toolHierarchy.root);
	return result && 'children' in result ? result : toolHierarchy.root;
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
 * Navigate to a specific category by ID
 */
export function navigateToCategory(categoryId: string) {
	toolNavigationPath.update((path) => [...path, categoryId]);
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
