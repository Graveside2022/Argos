import { randomUUID } from 'crypto';
import { glob } from 'glob';

import { extractCoverageMetrics } from '../coverage-extractor.js';
import { type Violation } from '../types.js';

/**
 * Validate Article III — Testing Standards
 * Checks: test coverage < 80%, missing tests for components
 */
export async function validateArticleIII(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	try {
		// Extract coverage metrics
		const coverage = await extractCoverageMetrics(projectRoot);

		// Check files that fail coverage threshold (§3.2)
		for (const file of coverage.details) {
			if (!file.meetsThreshold) {
				violations.push({
					id: randomUUID(),
					severity: 'HIGH',
					articleReference: 'Article III §3.2',
					ruleViolated: 'Test coverage must be ≥ 80%',
					filePath: file.filePath,
					lineNumber: 1,
					violationType: 'insufficient-test-coverage',
					suggestedFix: `Increase coverage from ${Math.round(file.linesPct)}% to 80% (add unit tests for uncovered functions)`,
					isPreExisting: false,
					exemptionStatus: 'none'
				});
			}
		}

		// Check for missing test files (§3.1)
		violations.push(...(await checkMissingTestFiles(projectRoot)));
	} catch (_error) {
		// If coverage file not found, report as violation
		violations.push({
			id: randomUUID(),
			severity: 'CRITICAL',
			articleReference: 'Article III §3.2',
			ruleViolated: 'Coverage data not available',
			filePath: 'coverage/coverage-final.json',
			lineNumber: 1,
			violationType: 'coverage-not-found',
			suggestedFix: 'Run `npm run test:coverage` to generate coverage data',
			isPreExisting: false,
			exemptionStatus: 'none'
		});
	}

	return violations;
}

/**
 * Check for source files without corresponding test files (§3.1)
 */
async function checkMissingTestFiles(projectRoot: string): Promise<Violation[]> {
	const violations: Violation[] = [];

	// Find all source files
	const sourceFiles = await glob('src/**/*.{ts,svelte}', {
		cwd: projectRoot,
		ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/*.d.ts']
	});

	for (const sourceFile of sourceFiles) {
		// Check if corresponding test file exists
		const testFile = sourceFile
			.replace(/\.(ts|svelte)$/, '.test.ts')
			.replace(/^src\//, 'tests/');

		const testExists = await glob(testFile, { cwd: projectRoot });

		if (testExists.length === 0 && shouldHaveTests(sourceFile)) {
			violations.push({
				id: randomUUID(),
				severity: 'MEDIUM',
				articleReference: 'Article III §3.1',
				ruleViolated: 'Components and utilities must have tests',
				filePath: sourceFile,
				lineNumber: 1,
				violationType: 'missing-test-file',
				suggestedFix: `Create test file: ${testFile}`,
				isPreExisting: false,
				exemptionStatus: 'none'
			});
		}
	}

	return violations;
}

/**
 * Determine if file should have tests
 */
function shouldHaveTests(filePath: string): boolean {
	// Components should have tests
	if (filePath.includes('/components/') || filePath.endsWith('.svelte')) {
		return true;
	}

	// Utilities and libraries should have tests
	if (filePath.includes('/lib/') && !filePath.includes('/types/')) {
		return true;
	}

	// Routes don't require tests (integration tested)
	if (filePath.includes('/routes/')) {
		return false;
	}

	return false;
}
