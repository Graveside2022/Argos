import { type Violation } from '../types.js';

/**
 * Validate Article I — Comprehension Before Action
 * TODO(#8): Implement comprehension lock checks (future version)
 *
 * Placeholder for v1 — requires manual review workflow
 */
export async function validateArticleI(_projectRoot: string): Promise<Violation[]> {
	// Article I enforcement is primarily workflow-based (not automated)
	// Future versions may check for:
	// - .specify/comprehension-locks/ files
	// - Commit message patterns indicating rushed work
	// - Code changes without corresponding planning artifacts

	return [];
}
