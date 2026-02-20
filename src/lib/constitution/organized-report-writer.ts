/**
 * Organized Report Writer for Constitutional Audit
 *
 * Orchestrates the creation of organized folder structure with
 * category analysis and dependency investigation.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { logger } from '../utils/logger.js';
import { generateCategoryREADME } from './analysis-generator.js';
import { organizeViolations, type ViolationCategory } from './category-organizer.js';
import { analyzeDependencies, type DependencyAnalysis } from './dependency-analyzer.js';
import { generateDependencyReport, generateMasterREADME } from './master-report-generator.js';
import { type AuditReport } from './types.js';

/**
 * Write organized audit reports with category folders and analysis
 */
export async function writeOrganizedReports(
	report: AuditReport,
	reportOutputDir: string,
	projectRoot: string
): Promise<void> {
	logger.info('Organizing violations into categories');

	// Step 1: Organize violations into categories
	const categories = organizeViolations(report.violations);

	if (categories.length === 0) {
		logger.info('No violations found - skipping organized report generation');
		return;
	}

	logger.info('Found violation categories', { count: categories.length });

	// Step 2: Analyze dependencies for each category
	logger.info('Analyzing dependencies for each category');
	const depAnalyses = await analyzeDependencies(categories, projectRoot);
	logger.info('Dependency analysis complete');

	// Step 3: Create dated subfolder for this audit
	const timestamp = new Date(report.timestamp);
	const dateFolder = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
	const auditFolder = join(reportOutputDir, dateFolder);

	await mkdir(auditFolder, { recursive: true });
	logger.info('Created audit folder', { dateFolder });

	// Step 4: Create category folders and READMEs
	logger.info('Generating category analyses');

	for (const category of categories) {
		const categoryFolder = join(auditFolder, category.folderName);
		await mkdir(categoryFolder, { recursive: true });

		// Generate and write category README
		const depAnalysis = depAnalyses.get(category.id);
		if (depAnalysis) {
			const readmeContent = generateCategoryREADME(category, depAnalysis);
			await writeFile(join(categoryFolder, 'README.md'), readmeContent, 'utf-8');
			logger.info('Generated category README', { folder: category.folderName });
		}
	}

	// Step 5: Generate master README
	logger.info('Generating master README');
	const masterREADME = generateMasterREADME(
		categories,
		report.overallCompliancePercent,
		report.totalViolations,
		report.timestamp
	);
	await writeFile(join(auditFolder, 'README.md'), masterREADME, 'utf-8');
	logger.info('Generated master README');

	// Step 6: Generate dependency investigation report
	logger.info('Generating dependency investigation report');
	const depReport = generateDependencyReport(categories, depAnalyses, report.timestamp);
	await writeFile(join(auditFolder, 'DEPENDENCY-INVESTIGATION-REPORT.md'), depReport, 'utf-8');
	logger.info('Generated dependency investigation report');

	// Step 7: Write summary
	logger.info('Organized audit reports generated successfully', {
		categoryCount: categories.length,
		auditFolder
	});

	// Print dependency summary
	printDependencySummary(categories, depAnalyses);
}

/**
 * Print dependency summary to console
 */
function printDependencySummary(
	categories: ViolationCategory[],
	depAnalyses: Map<string, DependencyAnalysis>
): void {
	const zeroDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length === 0;
	});

	const needsDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length > 0;
	});

	if (zeroDeps.length > 0) {
		logger.info('Zero dependencies needed', { categories: zeroDeps.map((c) => c.name) });
	}

	if (needsDeps.length > 0) {
		const depsRequired = needsDeps.map((cat) => {
			const analysis = depAnalyses.get(cat.id);
			return {
				name: cat.name,
				packageCount: analysis?.newDependencies.length ?? 0,
				bundleSizeKB: analysis?.bundleSizeImpactKB ?? 0
			};
		});
		logger.info('Dependencies required', { categories: depsRequired });
	}

	logger.info('Dependency summary complete', {
		zeroDepsCount: zeroDeps.length,
		needsDepsCount: needsDeps.length
	});
}

/**
 * Helper to summarize category findings
 */
export function summarizeCategories(categories: ViolationCategory[]): void {
	const summary = categories.map((cat) => ({
		name: cat.name,
		violationCount: cat.violations.length,
		priority: cat.priority
	}));
	logger.info('Violation categories summary', { categories: summary });
}

