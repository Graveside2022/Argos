/**
 * Factory function for creating ToolDefinition objects with sensible defaults.
 *
 * Most tools in the offnet hierarchy share three identical fields:
 *   isInstalled: false, canOpen: false, shouldShowControls: false
 *
 * createTool() supplies these defaults so each call site only specifies
 * tool-specific fields (id, name, description, icon, deployment) plus
 * any overrides for the optional/installed tools.
 */

import type { ToolDefinition } from '$lib/types/tools';

/** Fields the caller must always provide. */
type RequiredToolFields = Pick<
	ToolDefinition,
	'id' | 'name' | 'description' | 'icon' | 'deployment'
>;

/** Optional overrides for the defaulted fields plus any extra ToolDefinition props. */
type OptionalToolFields = Partial<Omit<ToolDefinition, keyof RequiredToolFields>>;

/** Create a ToolDefinition with defaults: isInstalled=false, canOpen=false, shouldShowControls=false. */
export function createTool(
	required: RequiredToolFields,
	overrides?: OptionalToolFields
): ToolDefinition {
	return {
		isInstalled: false,
		canOpen: false,
		shouldShowControls: false,
		...required,
		...overrides
	};
}
