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
			if (!file.meetsThreshold && shouldRequireHighCoverage(file.filePath)) {
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
 * Realistic exclusions for files that are integration-tested, type-only, or config-like
 */
function shouldHaveTests(filePath: string): boolean {
	// SvelteKit route files — integration/e2e tested, not unit tested
	if (filePath.includes('/routes/')) {
		return false;
	}

	// SvelteKit special files — layout, page, error, server handlers
	const basename = filePath.split('/').pop() || '';
	if (/^\+(page|layout|error|server)\.(ts|svelte)$/.test(basename)) {
		return false;
	}

	// Type/interface-only files — no runtime behavior to test
	if (filePath.includes('/types') || filePath.endsWith('.d.ts') || basename === 'types.ts') {
		return false;
	}

	// MCP server files — diagnostic tools, tested via integration
	if (filePath.includes('/server/mcp/')) {
		return false;
	}

	// Constitution/audit infrastructure — self-validates
	if (filePath.includes('/constitution/')) {
		return false;
	}

	// Constants and static data files
	if (basename.includes('constants') || basename.includes('config')) {
		return false;
	}

	// Store files with simple reactive wrappers
	if (filePath.includes('/stores/') && basename.endsWith('.ts')) {
		return false;
	}

	// Components should have tests
	if (filePath.includes('/components/') || filePath.endsWith('.svelte')) {
		return true;
	}

	// Utilities and libraries should have tests
	if (filePath.includes('/lib/') && !filePath.includes('/types/')) {
		return true;
	}

	return false;
}

/**
 * Determine if file should require high (80%) test coverage
 * Realistic exclusions for files where unit test coverage is impractical or unnecessary
 */
function shouldRequireHighCoverage(filePath: string): boolean {
	// Exclude vendor/third-party code
	if (filePath.includes('node_modules/') || filePath.includes('.venv/')) {
		return false;
	}

	// Exclude compiled/build output (service/dist contains compiled JS)
	if (filePath.includes('/dist/') || filePath.includes('/build/')) {
		return false;
	}

	// Exclude all scripts (build tools, ops scripts, one-off utilities)
	if (filePath.startsWith('scripts/')) {
		return false;
	}

	// Exclude config directory
	if (filePath.startsWith('config/')) {
		return false;
	}

	// Exclude benchmark and audit scripts
	if (filePath.includes('benchmark-') || filePath.includes('run-audit')) {
		return false;
	}

	// Exclude constitution/audit infrastructure (self-validates, has own test suite)
	if (filePath.includes('/constitution/')) {
		return false;
	}

	// Exclude configuration files
	if (
		filePath.endsWith('.config.ts') ||
		filePath.endsWith('.config.js') ||
		filePath.endsWith('.config.cjs')
	) {
		return false;
	}

	// Exclude type definition files
	if (filePath.endsWith('.d.ts')) {
		return false;
	}

	// Exclude SvelteKit route files — these are integration tested, not unit tested
	const basename = filePath.split('/').pop() || '';
	if (/^\+(page|layout|error|server)\.(ts|js|svelte)$/.test(basename)) {
		return false;
	}

	// Exclude Svelte components — coverage tooling for Svelte is unreliable
	if (filePath.endsWith('.svelte')) {
		return false;
	}

	// Exclude MCP server files — diagnostic tools, tested via integration
	if (filePath.includes('/server/mcp/')) {
		return false;
	}

	// Exclude type-only files
	if (basename === 'types.ts' || filePath.includes('/types/')) {
		return false;
	}

	// Exclude store files (simple reactive wrappers)
	if (filePath.includes('/stores/')) {
		return false;
	}

	// Require coverage for core application code
	return true;
}
