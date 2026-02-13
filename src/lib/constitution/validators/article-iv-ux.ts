import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { glob } from 'glob';

import { type Violation } from '../types.js';

/**
 * Validate Article IV — UX Consistency
 * Checks: missing required states (empty, loading, error, success)
 */
export async function validateArticleIV(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	// Find all Svelte components
	const components = await glob('src/**/*.svelte', {
		cwd: projectRoot,
		ignore: ['**/node_modules/**']
	});

	for (const component of components) {
		const content = await readFile(`${projectRoot}/${component}`, 'utf-8');

		// Check for required state handling (§4.3)
		violations.push(...checkMissingStates(component, content));

		// Check for duplicate implementations (§4.2 reuse-before-create)
		// Note: This is a simplified heuristic check
		violations.push(...checkDuplicatePatterns(component, content));
	}

	return violations;
}

/**
 * Check for components missing required states (§4.3)
 */
function checkMissingStates(file: string, content: string): Violation[] {
	const violations: Violation[] = [];

	// Skip simple presentational components
	if (content.length < 500) return violations;

	const hasAsync = /\$effect|fetch|await/.test(content);
	const hasData = /\$props|data/.test(content);

	if (hasAsync || hasData) {
		const states = {
			loading: /loading|isLoading|pending/.test(content),
			error: /error|hasError/.test(content),
			empty: /empty|isEmpty|no.*found/i.test(content)
		};

		for (const [state, hasState] of Object.entries(states)) {
			if (!hasState) {
				violations.push({
					id: randomUUID(),
					severity: 'MEDIUM',
					articleReference: 'Article IV §4.3',
					ruleViolated: `Components must handle ${state} state`,
					filePath: file,
					lineNumber: 1,
					violationType: `missing-${state}-state`,
					suggestedFix: `Add ${state} state handling to component`,
					isPreExisting: false,
					exemptionStatus: 'none'
				});
			}
		}
	}

	return violations;
}

/**
 * Check for duplicate pattern implementations (§4.2)
 */
function checkDuplicatePatterns(file: string, content: string): Violation[] {
	const violations: Violation[] = [];

	// Check for common duplicated patterns
	const patterns = [
		{ name: 'modal', regex: /class=".*modal.*"/ },
		{ name: 'button', regex: /class=".*btn.*"/ },
		{ name: 'card', regex: /class=".*card.*"/ }
	];

	for (const pattern of patterns) {
		const matches = content.match(new RegExp(pattern.regex, 'g'));
		if (matches && matches.length > 3) {
			violations.push({
				id: randomUUID(),
				severity: 'LOW',
				articleReference: 'Article IV §4.2',
				ruleViolated: 'Reuse existing components before creating new ones',
				filePath: file,
				lineNumber: 1,
				violationType: 'potential-duplicate-implementation',
				suggestedFix: `Consider extracting ${pattern.name} pattern into reusable component`,
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	}

	return violations;
}
