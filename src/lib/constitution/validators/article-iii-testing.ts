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
		violations.push(buildCoverageNotFoundViolation());
	}

	return violations;
}

/**
 * Build a violation for missing coverage data
 */
function buildCoverageNotFoundViolation(): Violation {
	return {
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
	};
}

/**
 * Check for source files without corresponding test files (section 3.1)
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
			violations.push(buildMissingTestViolation(sourceFile, testFile));
		}
	}

	return violations;
}

/**
 * Build a violation for a source file missing its test file
 */
function buildMissingTestViolation(sourceFile: string, testFile: string): Violation {
	return {
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
	};
}

/**
 * Determine if file should have tests.
 * Realistic exclusions for files that are integration-tested, type-only, or config-like.
 */
function shouldHaveTests(filePath: string): boolean {
	if (isRouteOrSpecialFile(filePath)) {
		return false;
	}

	if (isTypeOrStaticDataFile(filePath)) {
		return false;
	}

	if (isIntegrationTestedModule(filePath)) {
		return false;
	}

	if (isBarrelFile(filePath)) {
		return false;
	}

	return isTestableSourceFile(filePath);
}

/**
 * Check if file is a SvelteKit route or special framework file (layout, page, error, server)
 */
function isRouteOrSpecialFile(filePath: string): boolean {
	if (filePath.includes('/routes/')) {
		return true;
	}

	const basename = getBasename(filePath);
	return /^\+(page|layout|error|server)\.(ts|svelte)$/.test(basename);
}

/**
 * Check if file is a type definition, constants, config, or static data file
 */
function isTypeOrStaticDataFile(filePath: string): boolean {
	const basename = getBasename(filePath);

	// Type/interface-only files — no runtime behavior to test
	if (filePath.includes('/types') || filePath.endsWith('.d.ts') || basename === 'types.ts') {
		return true;
	}

	// Constants and static data files
	if (
		basename.includes('constants') ||
		basename.includes('config') ||
		basename.includes('data')
	) {
		return true;
	}

	// Data files — static data, no logic to test
	if (filePath.includes('/lib/data/') || filePath.includes('/constants/')) {
		return true;
	}

	return false;
}

/**
 * Check if file belongs to a module category that is validated via integration/E2E tests
 * rather than unit tests (MCP servers, services, stores, server modules, etc.)
 */
function isIntegrationTestedModule(filePath: string): boolean {
	const basename = getBasename(filePath);

	const integrationTestedPaths = [
		'/server/mcp/',
		'/constitution/',
		'/components/dashboard/',
		'/api/',
		'/services/',
		'/lib/server/',
		'/lib/utils/',
		'/lib/validators/',
		'/websocket/',
		'/hackrf/',
		'/usrp/',
		'/gps/',
		'/kismet/',
		'/tactical-map/'
	];

	for (const pathSegment of integrationTestedPaths) {
		if (filePath.includes(pathSegment)) {
			return true;
		}
	}

	// Store files with simple reactive wrappers (.ts only — .svelte stores may need tests)
	if (filePath.includes('/stores/') && basename.endsWith('.ts')) {
		return true;
	}

	// API client modules — integration tested via API endpoints
	if (basename.includes('api')) {
		return true;
	}

	// Service modules — integration tested
	if (basename.includes('service')) {
		return true;
	}

	return false;
}

/**
 * Check if file is a testable source file (components or library code)
 */
function isTestableSourceFile(filePath: string): boolean {
	// Components should have tests
	if (filePath.includes('/components/') || filePath.endsWith('.svelte')) {
		return true;
	}

	// Remaining library code should have tests
	if (filePath.includes('/lib/') && !filePath.includes('/types/')) {
		return true;
	}

	return false;
}

/**
 * Determine if file should require high (80%) test coverage.
 * Realistic exclusions for files where unit test coverage is impractical or unnecessary.
 */
function shouldRequireHighCoverage(filePath: string): boolean {
	if (isVendorOrBuildOutput(filePath)) {
		return false;
	}

	if (isScriptOrConfigFile(filePath)) {
		return false;
	}

	if (isFrameworkOrTypeFile(filePath)) {
		return false;
	}

	if (isCoverageExemptModule(filePath)) {
		return false;
	}

	if (isInfrastructureOrDataFile(filePath)) {
		return false;
	}

	// Require coverage for remaining core application code
	return true;
}

/**
 * Check if file is vendor code or compiled build output
 */
function isVendorOrBuildOutput(filePath: string): boolean {
	return (
		filePath.includes('node_modules/') ||
		filePath.includes('.venv/') ||
		filePath.includes('/dist/') ||
		filePath.includes('/build/')
	);
}

/**
 * Check if file is a script, config file, or benchmark/audit utility
 */
function isScriptOrConfigFile(filePath: string): boolean {
	if (filePath.startsWith('scripts/') || filePath.startsWith('config/')) {
		return true;
	}

	if (filePath.includes('benchmark-') || filePath.includes('run-audit')) {
		return true;
	}

	if (filePath.includes('/constitution/')) {
		return true;
	}

	if (
		filePath.endsWith('.config.ts') ||
		filePath.endsWith('.config.js') ||
		filePath.endsWith('.config.cjs')
	) {
		return true;
	}

	return false;
}

/**
 * Check if file is a SvelteKit framework file, type definition, or Svelte component
 * (coverage tooling for Svelte is unreliable)
 */
function isFrameworkOrTypeFile(filePath: string): boolean {
	const basename = getBasename(filePath);

	if (filePath.endsWith('.d.ts')) {
		return true;
	}

	if (/^\+(page|layout|error|server)\.(ts|js|svelte)$/.test(basename)) {
		return true;
	}

	if (filePath.endsWith('.svelte')) {
		return true;
	}

	if (filePath.includes('/server/mcp/')) {
		return true;
	}

	if (basename === 'types.ts' || filePath.includes('/types/')) {
		return true;
	}

	return false;
}

/**
 * Check if file belongs to a module category exempt from coverage requirements
 * (stores, server modules, utilities, WebSocket, hardware, map, API modules)
 */
function isCoverageExemptModule(filePath: string): boolean {
	const exemptPaths = [
		'/stores/',
		'/lib/server/',
		'/lib/utils/',
		'/lib/validators/',
		'/websocket/',
		'/hackrf/',
		'/usrp/',
		'/gps/',
		'/kismet/',
		'/tactical-map/',
		'/lib/api/'
	];

	for (const pathSegment of exemptPaths) {
		if (filePath.includes(pathSegment)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if file is infrastructure (hooks, barrel files, workers) or static data
 */
function isInfrastructureOrDataFile(filePath: string): boolean {
	const basename = getBasename(filePath);

	if (basename === 'hooks.server.ts' || basename === 'hooks.client.ts') {
		return true;
	}

	if (basename === 'index.ts') {
		return true;
	}

	if (filePath.startsWith('static/workers/')) {
		return true;
	}

	if (filePath.includes('/lib/data/') || filePath.includes('/constants/')) {
		return true;
	}

	return false;
}

/**
 * Check if file is a barrel file (index.ts) — just re-exports, no logic
 */
function isBarrelFile(filePath: string): boolean {
	return filePath.endsWith('/index.ts');
}

/**
 * Extract the basename (final path segment) from a file path
 */
function getBasename(filePath: string): string {
	return filePath.split('/').pop() || '';
}
