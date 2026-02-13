/**
 * Master Report Generator for Constitutional Audit
 *
 * Generates top-level README and dependency investigation report
 * for the entire audit analysis.
 */

import { type ViolationCategory } from './category-organizer.js';
import { type DependencyAnalysis } from './dependency-analyzer.js';

/**
 * Generate master README for the dated audit folder
 */
export function generateMasterREADME(
	categories: ViolationCategory[],
	overallCompliance: number,
	totalViolations: number,
	timestamp: string
): string {
	const lines: string[] = [];

	// Header
	const date = new Date(timestamp);
	const dateStr = `${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

	lines.push(`# Constitutional Audit Report - ${dateStr}`);
	lines.push('');
	lines.push(`**Report Directory**: \`/docs/reports/${date.toISOString().split('T')[0]}/\``);
	lines.push(`**Audit Execution**: ${date.toLocaleTimeString()}, ${dateStr}`);
	lines.push(`**Constitution Version**: 2.0.0`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Quick Summary
	lines.push('## 📊 Quick Summary');
	lines.push('');
	lines.push(`**Overall Compliance**: ${overallCompliance}% (Baseline)`);
	lines.push(`**Total Violations**: ${totalViolations}`);
	lines.push('');

	// Breakdown by severity
	const critical = categories.filter((c) => c.priority === 'CRITICAL');
	const high = categories.filter((c) => c.priority === 'HIGH');
	const medium = categories.filter((c) => c.priority === 'MEDIUM');
	const low = categories.filter((c) => c.priority === 'LOW');

	const criticalCount = critical.reduce((sum, c) => sum + c.violations.length, 0);
	const highCount = high.reduce((sum, c) => sum + c.violations.length, 0);
	const mediumCount = medium.reduce((sum, c) => sum + c.violations.length, 0);
	const lowCount = low.reduce((sum, c) => sum + c.violations.length, 0);

	lines.push(`- 🔴 CRITICAL: ${criticalCount} (${critical.map((c) => c.name).join(', ')})`);
	lines.push(`- 🟠 HIGH: ${highCount} (${high.map((c) => c.name).join(', ')})`);
	lines.push(`- 🟡 MEDIUM: ${mediumCount} (${medium.map((c) => c.name).join(', ')})`);
	lines.push(`- ⚪ LOW: ${lowCount} (${low.map((c) => c.name).join(', ')})`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Report Structure
	lines.push('## 📁 Report Structure');
	lines.push('');

	for (const category of categories) {
		lines.push(
			`### **${category.folderName}/** (${category.priority} - ${category.violations.length} violations)`
		);
		lines.push('');
		lines.push(category.description);
		lines.push('');
		lines.push('**Documents:**');
		lines.push('');
		lines.push(`- \`README.md\` - Complete analysis with remediation options`);
		lines.push(`- Dependency analysis integrated`);
		lines.push('');
		lines.push(`**Decision Required:** Choose remediation option (A, B, or C)`);
		lines.push('');
		lines.push('---');
		lines.push('');
	}

	// Core Audit Files
	lines.push('### **Core Audit Files**');
	lines.push('');
	lines.push(
		`- \`audit-${timestamp.replace(/[:.]/g, '-')}.json\` - Machine-readable full report`
	);
	lines.push(`- \`audit-${timestamp.replace(/[:.]/g, '-')}.md\` - Human-readable report`);
	lines.push(`- \`DEPENDENCY-INVESTIGATION-REPORT.md\` - Comprehensive dependency analysis`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Priority Matrix
	lines.push('## 🎯 Priority Matrix');
	lines.push('');

	if (critical.length > 0) {
		lines.push('### 🔴 **CRITICAL (Immediate Attention)**');
		lines.push('');
		for (const [idx, cat] of critical.entries()) {
			lines.push(`${idx + 1}. **${cat.name}** (${cat.violations.length} violations)`);
			lines.push(`    - **Impact:** ${cat.impact}`);
			lines.push(`    - **Recommendation:** ${getCriticalRecommendation(cat)}`);
			lines.push(`    - **Timeline:** ${cat.estimatedTimelineWeeks} weeks`);
			lines.push('');
		}
	}

	if (high.length > 0) {
		lines.push('### 🟠 **HIGH (Should Fix Soon)**');
		lines.push('');
		for (const [idx, cat] of high.entries()) {
			lines.push(`${idx + 1}. **${cat.name}** (${cat.violations.length} violations)`);
			lines.push(`    - **Impact:** ${cat.impact}`);
			lines.push(`    - **Recommendation:** ${getHighRecommendation(cat)}`);
			lines.push(`    - **Timeline:** ${cat.estimatedTimelineWeeks} weeks`);
			lines.push('');
		}
	}

	if (medium.length > 0) {
		lines.push('### 🟡 **MEDIUM (Plan for Later)**');
		lines.push('');
		for (const [idx, cat] of medium.entries()) {
			lines.push(`${idx + 1}. **${cat.name}** (${cat.violations.length} violations)`);
			lines.push(`    - **Impact:** ${cat.impact}`);
			lines.push(`    - **Timeline:** ${cat.estimatedTimelineWeeks} weeks`);
			lines.push('');
		}
	}

	if (low.length > 0) {
		lines.push('### ⚪ **LOW (Optional)**');
		lines.push('');
		for (const [idx, cat] of low.entries()) {
			lines.push(`${idx + 1}. **${cat.name}** (${cat.violations.length} violations)`);
			lines.push(`    - **Recommendation:** Optional - address if time permits`);
			lines.push('');
		}
	}

	lines.push('---');
	lines.push('');

	// Recommended Implementation Order
	lines.push('## 🚀 Recommended Implementation Order');
	lines.push('');
	lines.push('Based on priority and impact:');
	lines.push('');

	const sortedCategories = [...categories].sort((a, b) => {
		const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
		return priorityOrder[a.priority] - priorityOrder[b.priority];
	});

	for (const [idx, cat] of sortedCategories.entries()) {
		lines.push(
			`${idx + 1}. **${cat.name}** (${cat.priority}) - ${cat.estimatedTimelineWeeks} weeks`
		);
	}

	lines.push('');
	lines.push('---');
	lines.push('');

	// Compliance Score Projections
	lines.push('## 📊 Compliance Score Projections');
	lines.push('');
	lines.push('| Action | Compliance | Timeline | Risk |');
	lines.push('|--------|-----------|----------|------|');
	lines.push(`| **Current Baseline** | ${overallCompliance}% | - | - |`);

	let projectedCompliance = overallCompliance;
	for (const cat of sortedCategories) {
		const impactPercent = (cat.violations.length / totalViolations) * (100 - overallCompliance);
		projectedCompliance += impactPercent;
		const risk = cat.folderName === '02-service-layer-violations' ? 'MEDIUM' : 'LOW';
		lines.push(
			`| **+ ${cat.name}** | ${Math.round(projectedCompliance)}% | ${cat.estimatedTimelineWeeks} weeks | ${risk} |`
		);
	}

	lines.push('');
	lines.push('**Target:** >50% compliance ✅');
	lines.push('');
	lines.push('---');
	lines.push('');

	// How to Use This Report
	lines.push('## 📖 How to Use This Report');
	lines.push('');
	lines.push('### **For Strategic Decision-Making:**');
	lines.push('');
	lines.push('1. Review each category folder (01-, 02-, 03-, etc.)');
	lines.push('2. Read the README.md in each folder for detailed analysis');
	lines.push('3. Review dependency requirements in DEPENDENCY-INVESTIGATION-REPORT.md');
	lines.push('4. Choose remediation options for each category');
	lines.push('');
	lines.push('### **For Implementation:**');
	lines.push('');
	lines.push('1. Start with CRITICAL violations (highest priority)');
	lines.push('2. Create git branches for each category: `feature/<category-folder-name>`');
	lines.push('3. Install required dependencies (see each category README)');
	lines.push('4. Follow the remediation plan in each category README');
	lines.push('5. Re-run audit after each category: `npm run constitutional-audit`');
	lines.push('');
	lines.push('### **For Tracking Progress:**');
	lines.push('');
	lines.push('- Use `audit-*.json` for programmatic queries');
	lines.push('- Re-run audit regularly to track compliance score');
	lines.push('- Update exemptions as needed');
	lines.push('');
	lines.push('---');
	lines.push('');

	// Next Actions
	lines.push('## 🎯 Next Actions');
	lines.push('');
	lines.push('### **Immediate (Today):**');
	lines.push('');
	lines.push('1. ✅ Review DEPENDENCY-INVESTIGATION-REPORT.md for dependency requirements');
	lines.push('2. ✅ Review CRITICAL category folders first');
	lines.push('3. ✅ Decide on remediation approach for each category');
	lines.push('');
	lines.push('### **This Week:**');
	lines.push('');
	lines.push('4. Begin remediation starting with highest priority categories');
	lines.push('5. Install required dependencies (see category READMEs)');
	lines.push('6. Create git branches and begin implementation');
	lines.push('');
	lines.push('### **Next Audit:**');
	lines.push('');
	lines.push('7. Run audit after fixes: `npm run constitutional-audit`');
	lines.push('8. Track compliance score improvement');
	lines.push('');
	lines.push('---');
	lines.push('');

	// Support
	lines.push('## 📞 Support');
	lines.push('');
	lines.push('**Documentation:**');
	lines.push('');
	lines.push('- Full audit system: `docs/constitutional-audit-tool/`');
	lines.push('- Constitution: `.specify/memory/constitution.md`');
	lines.push('- Each violation category has comprehensive analysis in its folder');
	lines.push('');
	lines.push('**Questions?**');
	lines.push('');
	lines.push('- Check the README.md in each category folder');
	lines.push('- Review DEPENDENCY-INVESTIGATION-REPORT.md');
	lines.push('- Re-run audit to validate fixes');
	lines.push('');
	lines.push('---');
	lines.push('');
	lines.push(`**Generated by:** Constitutional Audit System v2.0.0`);
	lines.push(`**Audit ID:** \`audit-${timestamp.replace(/[:.]/g, '-')}\``);
	lines.push(`**Timestamp:** ${dateStr}, ${date.toLocaleTimeString()}`);

	return lines.join('\n');
}

/**
 * Generate DEPENDENCY-INVESTIGATION-REPORT.md
 */
export function generateDependencyReport(
	categories: ViolationCategory[],
	depAnalyses: Map<string, DependencyAnalysis>,
	timestamp: string
): string {
	const lines: string[] = [];

	const date = new Date(timestamp);
	const dateStr = date.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});

	lines.push('# Dependency Investigation Report');
	lines.push('');
	lines.push(`**Generated:** ${dateStr}`);
	lines.push('**Methodology:** Dependency Verification Rulebook v2.0');
	lines.push('**Purpose:** Validate dependencies for constitutional audit remediation');
	lines.push('');
	lines.push('---');
	lines.push('');

	// Executive Summary
	lines.push('## 📊 Executive Summary');
	lines.push('');
	lines.push('| Goal | New Dependencies | Bundle Impact | Cost | Risk |');
	lines.push('|------|------------------|---------------|------|------|');

	for (const category of categories) {
		const analysis = depAnalyses.get(category.id);
		if (!analysis) continue;

		const depsCount = analysis.newDependencies.length;
		const bundleImpact = analysis.bundleSizeImpactKB;
		lines.push(
			`| **${category.name}** | ${depsCount} packages | +${bundleImpact}KB | ${analysis.totalCost} | ${analysis.riskLevel} |`
		);
	}

	lines.push('');
	lines.push('---');
	lines.push('');

	// Critical Findings
	lines.push('## ✅ Critical Findings');
	lines.push('');

	const zeroDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length === 0;
	});

	if (zeroDeps.length > 0) {
		lines.push('### ZERO Dependencies Needed:');
		lines.push('');
		for (const cat of zeroDeps) {
			lines.push(`- ✅ **${cat.name}** - Ready to proceed immediately`);
		}
		lines.push('');
	}

	const needsDeps = categories.filter((c) => {
		const analysis = depAnalyses.get(c.id);
		return analysis && analysis.newDependencies.length > 0;
	});

	if (needsDeps.length > 0) {
		lines.push('### Dependencies Required:');
		lines.push('');
		for (const cat of needsDeps) {
			const analysis = depAnalyses.get(cat.id);
			if (!analysis) continue;
			lines.push(
				`- ⚠️ **${cat.name}** - ${analysis.newDependencies.length} packages (+${analysis.bundleSizeImpactKB}KB)`
			);
		}
		lines.push('');
	}

	lines.push('---');
	lines.push('');

	// Per-Category Analysis
	for (const category of categories) {
		const analysis = depAnalyses.get(category.id);
		if (!analysis) continue;

		lines.push(`# ${category.name}`);
		lines.push('');
		lines.push(`**Priority:** ${category.priority}`);
		lines.push(`**New Dependencies:** ${analysis.newDependencies.length} packages`);
		lines.push(`**Bundle Impact:** +${analysis.bundleSizeImpactKB}KB`);
		lines.push(`**Cost:** ${analysis.totalCost}`);
		lines.push(`**Risk:** ${analysis.riskLevel}`);
		lines.push('');

		if (analysis.newDependencies.length > 0) {
			lines.push('## Required Dependencies');
			lines.push('');
			for (const dep of analysis.newDependencies) {
				lines.push(`### ${dep.name}@${dep.version}`);
				lines.push(`- **Purpose:** ${dep.purpose}`);
				lines.push(`- **Size:** ~${dep.sizeKB}KB`);
				lines.push(`- **License:** ${dep.license}`);
				lines.push(`- **Type:** ${dep.packageType}`);
				lines.push('');
			}

			lines.push('## Installation');
			lines.push('');
			lines.push('```bash');
			for (const cmd of analysis.installCommands) {
				lines.push(cmd);
			}
			lines.push('```');
			lines.push('');
		} else {
			lines.push('## ✅ Zero Dependencies Required');
			lines.push('');
			lines.push('This category requires no new dependencies. Ready to proceed immediately.');
			lines.push('');
		}

		lines.push('## Prerequisites');
		lines.push('');
		for (const prereq of analysis.prerequisites) {
			lines.push(`- ✅ ${prereq}`);
		}
		lines.push('');

		lines.push('## Verification');
		lines.push('');
		lines.push('```bash');
		for (const cmd of analysis.verificationCommands) {
			lines.push(cmd);
		}
		lines.push('```');
		lines.push('');
		lines.push('---');
		lines.push('');
	}

	// Footer
	lines.push(`**Report Generated:** ${dateStr}`);
	lines.push('**Methodology:** Dependency Verification Rulebook v2.0 (8 phases)');
	lines.push('**Status:** ✅ All dependencies validated, ready for implementation');

	return lines.join('\n');
}

// Helper functions

function getCriticalRecommendation(category: ViolationCategory): string {
	if (category.folderName === '02-service-layer-violations') {
		return 'Exempt for now, refactor incrementally';
	}
	return 'Address immediately or document exemption';
}

function getHighRecommendation(category: ViolationCategory): string {
	if (category.folderName === '03-type-safety-violations') {
		return 'Add justification comments (Option A) - high ROI';
	}
	return 'Fix during normal development';
}
