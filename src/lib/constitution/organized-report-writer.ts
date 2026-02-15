/**
 * Organized Report Writer for Constitutional Audit
 *
 * Orchestrates the creation of organized folder structure with
 * category analysis and dependency investigation.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

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
	console.log('📁 Organizing violations into categories...');

	// Step 1: Organize violations into categories
	const categories = organizeViolations(report.violations);

	if (categories.length === 0) {
		console.log('✅ No violations found - skipping organized report generation');
		return;
	}

	console.log(`   Found ${categories.length} violation categories`);

	// Step 2: Analyze dependencies for each category
	console.log('📦 Analyzing dependencies for each category...');
	const depAnalyses = await analyzeDependencies(categories, projectRoot);
	console.log('   Dependency analysis complete');

	// Step 3: Create dated subfolder for this audit
	const timestamp = new Date(report.timestamp);
	const dateFolder = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
	const auditFolder = join(reportOutputDir, dateFolder);

	await mkdir(auditFolder, { recursive: true });
	console.log(`   Created audit folder: ${dateFolder}/`);

	// Step 4: Create category folders and READMEs
	console.log('📝 Generating category analyses...');

	for (const category of categories) {
		const categoryFolder = join(auditFolder, category.folderName);
		await mkdir(categoryFolder, { recursive: true });

		// Generate and write category README
		const depAnalysis = depAnalyses.get(category.id);
		if (depAnalysis) {
			const readmeContent = generateCategoryREADME(category, depAnalysis);
			await writeFile(join(categoryFolder, 'README.md'), readmeContent, 'utf-8');
			console.log(`   ✓ ${category.folderName}/README.md`);
		}
	}

	// Step 5: Generate master README
	console.log('📄 Generating master README...');
	const masterREADME = generateMasterREADME(
		categories,
		report.overallCompliancePercent,
		report.totalViolations,
		report.timestamp
	);
	await writeFile(join(auditFolder, 'README.md'), masterREADME, 'utf-8');
	console.log(`   ✓ README.md (master report)`);

	// Step 6: Generate dependency investigation report
	console.log('🔍 Generating dependency investigation report...');
	const depReport = generateDependencyReport(categories, depAnalyses, report.timestamp);
	await writeFile(join(auditFolder, 'DEPENDENCY-INVESTIGATION-REPORT.md'), depReport, 'utf-8');
	console.log(`   ✓ DEPENDENCY-INVESTIGATION-REPORT.md`);

	// Step 7: Write summary
	console.log('');
	console.log('✅ Organized audit reports generated successfully!');
	console.log('');
	console.log(`📊 Summary:`);
	console.log(`   - ${categories.length} violation categories`);
	console.log(`   - ${categories.length} category READMEs`);
	console.log(`   - 1 master README`);
	console.log(`   - 1 dependency investigation report`);
	console.log('');
	console.log(`📁 Location: ${auditFolder}`);
	console.log('');

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
	console.log('💡 Dependency Summary:');
	console.log('');

	const zeroDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length === 0;
	});

	const needsDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length > 0;
	});

	if (zeroDeps.length > 0) {
		console.log('   ✅ ZERO dependencies needed for:');
		for (const cat of zeroDeps) {
			console.log(`      - ${cat.name}`);
		}
		console.log('');
	}

	if (needsDeps.length > 0) {
		console.log('   ⚠️  Dependencies required for:');
		for (const cat of needsDeps) {
			const analysis = depAnalyses.get(cat.id);
			if (!analysis) continue;
			console.log(
				`      - ${cat.name}: ${analysis.newDependencies.length} packages (+${analysis.bundleSizeImpactKB}KB)`
			);
		}
		console.log('');
	}

	console.log('📖 Next Steps:');
	console.log(`   1. Review the master README in the dated folder`);
	console.log(`   2. Check DEPENDENCY-INVESTIGATION-REPORT.md for dependency details`);
	console.log(`   3. Read each category README for remediation options`);
	console.log(`   4. Choose your implementation approach`);
	console.log('');
}

/**
 * Helper to summarize category findings
 */
export function summarizeCategories(categories: ViolationCategory[]): void {
	console.log('');
	console.log('📊 Violation Categories:');
	console.log('');

	for (const cat of categories) {
		const icon = getPriorityIcon(cat.priority);
		console.log(
			`   ${icon} ${cat.name}: ${cat.violations.length} violations (${cat.priority})`
		);
	}

	console.log('');
}

function getPriorityIcon(priority: string): string {
	switch (priority) {
		case 'CRITICAL':
			return '🔴';
		case 'HIGH':
			return '🟠';
		case 'MEDIUM':
			return '🟡';
		case 'LOW':
			return '⚪';
		default:
			return '';
	}
}
