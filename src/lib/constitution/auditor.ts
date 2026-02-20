import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { join } from 'path';

import { logger } from '../utils/logger.js';
import { parseConstitution } from './constitution-parser.js';
import { applyExemptions, filterExemptedViolations, parseExemptions } from './exemption-parser.js';
import { categorizeViolationByTimestamp } from './git-categorizer.js';
import { writeOrganizedReports as generateOrganizedReports } from './organized-report-writer.js';
import { generateReport, saveReport } from './report-generator.js';
import { calculateTrends } from './trend-tracker.js';
import {
	type AuditOptions,
	type AuditReport,
	AuditTimeoutError,
	type ComplianceScore,
	InvalidScopeError,
	type Violation
} from './types.js';
import { validateArticleI } from './validators/article-i-comprehension.js';
import { validateArticleII } from './validators/article-ii-code-quality.js';
import { validateArticleIII } from './validators/article-iii-testing.js';
import { validateArticleIV } from './validators/article-iv-ux.js';
import { validateArticleIX } from './validators/article-ix-security.js';
import { validateArticleV } from './validators/article-v-performance.js';
import { validateArticleVI } from './validators/article-vi-dependencies.js';
import { validateArticleVII } from './validators/article-vii-debugging.js';
import { validateArticleXII } from './validators/article-xii-git.js';

/**
 * Main audit orchestrator
 * Runs all validators, collects violations, categorizes by git blame, applies exemptions
 *
 * @param options - Audit configuration options
 * @returns Promise<AuditReport> - Complete audit report
 * @throws AuditTimeoutError if execution exceeds timeout
 * @throws InvalidScopeError if scope configuration is invalid
 */
export async function runAudit(options: AuditOptions): Promise<AuditReport> {
	const _startTime = Date.now();
	const projectRoot = options.projectRoot || process.cwd();
	const constitutionPath =
		options.constitutionPath || join(projectRoot, '.specify/memory/constitution.md');
	const timeoutMs = options.timeoutMs || 60000;

	// Set up timeout
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => reject(new AuditTimeoutError(timeoutMs)), timeoutMs);
	});

	try {
		return await Promise.race([
			runAuditInternal(options, projectRoot, constitutionPath),
			timeoutPromise
		]);
	} catch (error) {
		if (error instanceof AuditTimeoutError) {
			throw error;
		}
		throw error;
	}
}

/**
 * Internal audit execution (wrapped by timeout)
 */
async function runAuditInternal(
	options: AuditOptions,
	projectRoot: string,
	constitutionPath: string
): Promise<AuditReport> {
	const startTime = Date.now();

	// Parse constitution
	const articles = await parseConstitution(constitutionPath);
	const constitutionVersion = '2.0.0'; // Extract from constitution metadata

	// Run validators based on scope
	let violations = await runValidators(options, projectRoot);

	// Parse and apply exemptions
	const exemptions = await parseExemptions(projectRoot);
	violations = applyExemptions(violations, exemptions);

	// Categorize violations (pre-existing vs new)
	violations = await categorizeViolations(violations);

	// Calculate compliance scores (only count non-exempted violations)
	const activeViolations = filterExemptedViolations(violations);
	const articleScores = calculateArticleScores(articles, activeViolations);
	const overallCompliancePercent = calculateOverallCompliance(articleScores);

	// Count violations by severity (non-exempted only)
	const severityCounts = countBySeverity(activeViolations);

	const executionDurationMs = Date.now() - startTime;

	let report: AuditReport = {
		id: randomUUID(),
		timestamp: new Date().toISOString(),
		constitutionVersion,
		executionDurationMs,
		overallCompliancePercent,
		totalViolations: activeViolations.length,
		criticalViolations: severityCounts.CRITICAL,
		highViolations: severityCounts.HIGH,
		mediumViolations: severityCounts.MEDIUM,
		lowViolations: severityCounts.LOW,
		articleScores,
		violations,
		filesScanned: countScannedFiles(violations),
		scope: options.scope,
		scopeFilter: options.scopeFilter,
		trendDirection: 'baseline' // Will be calculated by trend tracker
	};

	// Calculate trends
	report = await calculateTrends(report, projectRoot);

	// Generate and save reports
	const reportOutputDir = options.reportOutputDir || join(projectRoot, 'docs/reports');
	await mkdir(reportOutputDir, { recursive: true });

	for (const format of options.outputFormats) {
		if (format === 'terminal') {
			// Display terminal output immediately
			logger.info(generateReport(report, 'terminal'));
		} else {
			// Save JSON and markdown reports to file
			const filepath = await saveReport(report, format, reportOutputDir);
			if (options.verbose) {
				logger.info('Report saved', { filepath });
			}
		}
	}

	// Generate organized reports with category analysis and dependency validation
	await generateOrganizedReports(report, reportOutputDir, projectRoot);

	return report;
}

/**
 * Run validators based on scope configuration
 */
async function runValidators(options: AuditOptions, projectRoot: string): Promise<Violation[]> {
	const { scope, scopeFilter } = options;

	// Validate scope configuration
	if ((scope === 'directory' || scope === 'article') && !scopeFilter) {
		throw new InvalidScopeError(scope, scopeFilter);
	}

	// Map of all validators
	const allValidators = {
		I: validateArticleI,
		II: validateArticleII,
		III: validateArticleIII,
		IV: validateArticleIV,
		V: validateArticleV,
		VI: validateArticleVI,
		VII: validateArticleVII,
		IX: validateArticleIX,
		XII: validateArticleXII
	};

	let validatorsToRun: Array<() => Promise<Violation[]>> = [];

	switch (scope) {
		case 'full':
			// Run all validators
			validatorsToRun = Object.values(allValidators).map(
				(validator) => () => validator(projectRoot)
			);
			break;

		case 'article': {
			// Run single article validator
			const articleMatch = scopeFilter?.match(/Article ([IVX]+)/);
			if (!articleMatch) {
				throw new InvalidScopeError(scope, scopeFilter);
			}
			// @constitutional-exemption Article-II-2.1 issue:#999 — Article key validated by regex match before assertion
			const articleId = articleMatch[1] as keyof typeof allValidators;
			const validator = allValidators[articleId];
			if (!validator) {
				throw new InvalidScopeError(scope, scopeFilter);
			}
			validatorsToRun = [() => validator(projectRoot)];
			break;
		}

		case 'incremental':
		case 'directory':
			// For MVP, run all validators and filter violations by scope
			// TODO(#10): Optimize by only scanning relevant files
			validatorsToRun = Object.values(allValidators).map(
				(validator) => () => validator(projectRoot)
			);
			break;

		default:
			throw new InvalidScopeError(scope, scopeFilter);
	}

	// Run validators in parallel
	const results = await Promise.all(validatorsToRun.map((fn) => fn()));
	const allViolations = results.flat();

	// Apply scope filter
	return applyScopeFilter(allViolations, scope, scopeFilter);
}

/**
 * Apply scope filter to violations
 */
function applyScopeFilter(
	violations: Violation[],
	scope: string,
	scopeFilter?: string
): Violation[] {
	if (scope === 'directory' && scopeFilter) {
		return violations.filter((v) => v.filePath.startsWith(scopeFilter));
	}

	// For incremental scope, would filter by git diff here
	// For MVP, return all violations
	return violations;
}

/**
 * Categorize violations by git blame (pre-existing vs new)
 */
async function categorizeViolations(violations: Violation[]): Promise<Violation[]> {
	const categorized = await Promise.all(
		violations.map(async (violation) => {
			try {
				const category = await categorizeViolationByTimestamp(
					violation.filePath,
					violation.lineNumber
				);
				return {
					...violation,
					isPreExisting: category.isPreExisting,
					commitDate: category.commitDate,
					commitHash: category.commitHash
				};
			} catch {
				// If categorization fails, assume new
				return violation;
			}
		})
	);

	return categorized;
}

/**
 * Calculate compliance scores per article
 */
function calculateArticleScores(
	articles: Array<{ id: string; title: string; number: number }>,
	violations: Violation[]
): ComplianceScore[] {
	const romanNumerals = [
		'I',
		'II',
		'III',
		'IV',
		'V',
		'VI',
		'VII',
		'VIII',
		'IX',
		'X',
		'XI',
		'XII'
	];

	return romanNumerals.map((id, index) => {
		const article = articles.find((a) => a.id === id) || {
			id,
			title: `Article ${id}`,
			number: index + 1
		};

		// Use word-boundary match to avoid prefix collisions
		// (e.g., "Article I" should not match "Article II", "Article III", "Article IX")
		const articlePrefixSection = `Article ${id} §`;
		const articleViolations = violations.filter(
			(v) =>
				v.articleReference.startsWith(articlePrefixSection) ||
				v.articleReference === `Article ${id}`
		);

		// For MVP, assume 10 checks per article
		const totalChecks = 10;
		const violationCount = articleViolations.length;
		const passingChecks = Math.max(0, totalChecks - violationCount);

		return {
			articleId: id,
			articleTitle: article.title,
			totalChecks,
			passingChecks,
			failingChecks: totalChecks - passingChecks,
			scorePercent: Math.round((passingChecks / totalChecks) * 100),
			violationCount,
			// Safe: String literal narrowed to const for trend direction type
			trendDirection: 'baseline' as const
		};
	});
}

/**
 * Calculate overall compliance percentage
 * Strict interpretation: only 100% scoring articles count as passing
 */
function calculateOverallCompliance(scores: ComplianceScore[]): number {
	const passingArticles = scores.filter((s) => s.scorePercent === 100).length;
	return Math.round((passingArticles / 12) * 100);
}

/**
 * Count violations by severity
 */
function countBySeverity(violations: Violation[]): Record<string, number> {
	return {
		CRITICAL: violations.filter((v) => v.severity === 'CRITICAL').length,
		HIGH: violations.filter((v) => v.severity === 'HIGH').length,
		MEDIUM: violations.filter((v) => v.severity === 'MEDIUM').length,
		LOW: violations.filter((v) => v.severity === 'LOW').length
	};
}

/**
 * Count unique files scanned
 */
function countScannedFiles(violations: Violation[]): number {
	const uniqueFiles = new Set(violations.map((v) => v.filePath));
	return uniqueFiles.size;
}
