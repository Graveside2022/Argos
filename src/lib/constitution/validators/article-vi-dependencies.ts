import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { type Violation } from '../types.js';

/**
 * Validate Article VI — Dependency Management
 * Checks: forbidden dependency categories, unpinned versions
 */
export async function validateArticleVI(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	const packageJsonPath = join(projectRoot, 'package.json');
	const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

	// Check for forbidden dependencies (§6.3)
	violations.push(...checkForbiddenDependencies(packageJson.dependencies || {}));
	violations.push(...checkForbiddenDependencies(packageJson.devDependencies || {}));

	// Check for unpinned versions (§6.1)
	violations.push(...checkUnpinnedVersions(packageJson.dependencies || {}));

	return violations;
}

/**
 * Check for forbidden dependency categories (§6.3)
 */
function checkForbiddenDependencies(dependencies: Record<string, string>): Violation[] {
	const violations: Violation[] = [];

	// Forbidden dependency patterns from Article VI §6.3
	const forbiddenPatterns = [
		{ pattern: /^(prisma|typeorm|sequelize|mongoose)$/, category: 'ORM' },
		{ pattern: /^(redux|mobx|recoil|zustand)$/, category: 'State Management Library' },
		{ pattern: /^(axios|got|node-fetch)$/, category: 'HTTP Client (use native fetch)' }
	];

	for (const [dep, version] of Object.entries(dependencies)) {
		for (const { pattern, category } of forbiddenPatterns) {
			if (pattern.test(dep)) {
				violations.push({
					id: randomUUID(),
					severity: 'CRITICAL',
					articleReference: 'Article VI §6.3',
					ruleViolated: `Forbidden dependency category: ${category}`,
					filePath: 'package.json',
					lineNumber: 1,
					violationType: 'forbidden-dependency',
					codeSnippet: `"${dep}": "${version}"`,
					suggestedFix: `Remove ${dep} and use approved alternative (see Article VI §6.3)`,
					isPreExisting: false,
					exemptionStatus: 'none'
				});
			}
		}
	}

	return violations;
}

/**
 * Check for unpinned versions (§6.1)
 */
function checkUnpinnedVersions(dependencies: Record<string, string>): Violation[] {
	const violations: Violation[] = [];

	for (const [dep, version] of Object.entries(dependencies)) {
		// Check for caret/tilde ranges
		if (version.startsWith('^') || version.startsWith('~')) {
			violations.push({
				id: randomUUID(),
				severity: 'MEDIUM',
				articleReference: 'Article VI §6.1',
				ruleViolated: 'Dependencies must have pinned versions',
				filePath: 'package.json',
				lineNumber: 1,
				violationType: 'unpinned-dependency-version',
				codeSnippet: `"${dep}": "${version}"`,
				suggestedFix: `Pin to exact version: "${dep}": "${version.replace(/^[\^~]/, '')}"`,
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	}

	return violations;
}
