/**
 * Analysis Document Generator for Constitutional Audit
 *
 * Generates comprehensive README.md files for each violation category
 * with analysis, options, risks, and implementation guidance.
 */

import { type ViolationCategory } from './category-organizer.js';
import { type DependencyAnalysis } from './dependency-analyzer.js';

/**
 * Generate README content for a violation category
 */
export function generateCategoryREADME(
	category: ViolationCategory,
	depAnalysis: DependencyAnalysis
): string {
	const sections = [
		buildHeaderSection(category),
		buildQuickSummarySection(category),
		buildDependencySection(category, depAnalysis),
		buildViolationDetailsSection(category),
		buildAnalysisBodySections(category, depAnalysis),
		buildComplianceImpactSection(category, depAnalysis)
	];

	return sections.join('\n');
}

// --- Section builders for generateCategoryREADME ---

/** Build the document header with category metadata and priority */
function buildHeaderSection(category: ViolationCategory): string {
	const lines: string[] = [];
	lines.push(`# ${category.name} Analysis`);
	lines.push('');
	lines.push(
		`**Violation Category:** ${category.priority} (${category.violations[0]?.articleReference || 'Multiple Articles'})`
	);
	lines.push(`**Violation Count:** ${category.violations.length} violations`);
	lines.push(`**Impact:** ${category.impact}`);
	lines.push(`**Status:** Pre-existing (created before constitution ratification)`);
	lines.push(
		`**Priority:** ${getPriorityIcon(category.priority)} **${category.priority}** - ${getPriorityDescription(category.priority)}`
	);
	lines.push('');
	lines.push('---');
	lines.push('');
	return lines.join('\n');
}

/** Build the quick summary section with problem, rule, and solution */
function buildQuickSummarySection(category: ViolationCategory): string {
	const lines: string[] = [];
	lines.push('## 📊 Quick Summary');
	lines.push('');
	lines.push(`**Problem:** ${category.description}`);
	lines.push(
		`**Constitution Rule:** ${category.violations[0]?.articleReference} - "${category.violations[0]?.ruleViolated}"`
	);
	lines.push(`**Solution:** ${getSolutionDescription(category)}`);
	lines.push('');
	lines.push('---');
	lines.push('');
	return lines.join('\n');
}

/** Build the dependency requirements section including install/verify commands */
function buildDependencySection(
	category: ViolationCategory,
	depAnalysis: DependencyAnalysis
): string {
	const lines: string[] = [];
	lines.push('## 📦 Dependency Requirements');
	lines.push('');
	lines.push(formatDependencyDetails(category, depAnalysis));
	lines.push(formatCommandBlocks(depAnalysis));
	lines.push('---');
	lines.push('');
	return lines.join('\n');
}

/** Format dependency listing: either zero-dep rationale or per-package breakdown */
function formatDependencyDetails(
	category: ViolationCategory,
	depAnalysis: DependencyAnalysis
): string {
	const lines: string[] = [];

	if (depAnalysis.newDependencies.length === 0) {
		lines.push('✅ **ZERO new dependencies required!**');
		lines.push('');
		lines.push(`**Rationale:** ${getDependencyRationale(category)}`);
		lines.push('');
	} else {
		lines.push(`**NEW Dependencies Required:** ${depAnalysis.newDependencies.length} packages`);
		lines.push(`**Bundle Size Impact:** +${depAnalysis.bundleSizeImpactKB}KB`);
		lines.push(`**Total Cost:** ${depAnalysis.totalCost}`);
		lines.push('');
		for (const dep of depAnalysis.newDependencies) {
			lines.push(`### ${dep.name}`);
			lines.push(`- **Version:** ${dep.version}`);
			lines.push(`- **Purpose:** ${dep.purpose}`);
			lines.push(`- **Size:** ~${dep.sizeKB}KB`);
			lines.push(`- **License:** ${dep.license}`);
			lines.push('');
		}
	}

	return lines.join('\n');
}

/** Format install and verification command blocks */
function formatCommandBlocks(depAnalysis: DependencyAnalysis): string {
	const lines: string[] = [];

	if (depAnalysis.installCommands.length > 0) {
		lines.push('**Installation:**');
		lines.push('');
		lines.push('```bash');
		for (const cmd of depAnalysis.installCommands) {
			lines.push(cmd);
		}
		lines.push('```');
		lines.push('');
	}

	lines.push('**Verification:**');
	lines.push('');
	lines.push('```bash');
	for (const cmd of depAnalysis.verificationCommands) {
		lines.push(cmd);
	}
	lines.push('```');
	lines.push('');
	return lines.join('\n');
}

/** Build the detected violations section with a sample of up to 10 entries */
function buildViolationDetailsSection(category: ViolationCategory): string {
	const lines: string[] = [];
	lines.push('## 🔍 Detected Violations');
	lines.push('');
	lines.push(`**Files Affected:** ${getUniqueFiles(category.violations).length}`);
	lines.push(`**Total Occurrences:** ${category.violations.length}`);
	lines.push('');

	const sampleViolations = category.violations.slice(0, 10);
	for (const [idx, violation] of sampleViolations.entries()) {
		lines.push(`### ${idx + 1}. ${violation.filePath}`);
		lines.push(`**Line:** ${violation.lineNumber}`);
		lines.push(`**Rule:** ${violation.ruleViolated}`);
		if (violation.suggestedFix) {
			lines.push(`**Fix:** ${violation.suggestedFix}`);
		}
		if (violation.isPreExisting) {
			lines.push(
				`**Status:** ⚠️ Pre-existing (since ${violation.commitDate?.split('T')[0] || 'unknown'})`
			);
		}
		lines.push('');
	}

	if (category.violations.length > 10) {
		lines.push(`*...and ${category.violations.length - 10} more violations*`);
		lines.push('');
	}

	lines.push('---');
	lines.push('');
	return lines.join('\n');
}

/** Build the remediation, risk, recommendation, and next steps sections */
function buildAnalysisBodySections(
	category: ViolationCategory,
	depAnalysis: DependencyAnalysis
): string {
	const lines: string[] = [];

	lines.push('## 🔄 Remediation Strategy');
	lines.push('');
	lines.push(getRemediationOptions(category, depAnalysis));
	lines.push('');
	lines.push('---');
	lines.push('');

	lines.push('## ⚖️ Risk Assessment');
	lines.push('');
	lines.push(`**Overall Risk Level:** ${depAnalysis.riskLevel}`);
	lines.push('');
	lines.push(getRiskAnalysis(category, depAnalysis));
	lines.push('');
	lines.push('---');
	lines.push('');

	lines.push('## 🎯 Recommendation');
	lines.push('');
	lines.push(getRecommendation(category, depAnalysis));
	lines.push('');
	lines.push('---');
	lines.push('');

	lines.push('## 📖 Next Steps');
	lines.push('');
	lines.push(getNextSteps(category, depAnalysis));
	lines.push('');
	lines.push('---');
	lines.push('');
	return lines.join('\n');
}

/** Build the compliance impact section showing post-remediation projections */
function buildComplianceImpactSection(
	category: ViolationCategory,
	depAnalysis: DependencyAnalysis
): string {
	const lines: string[] = [];
	lines.push('## 📊 Impact on Compliance Score');
	lines.push('');
	lines.push('**After Remediation:**');
	lines.push('');
	lines.push(
		`- **${category.priority} violations:** ${category.violations.length} → 0 (all resolved)`
	);
	lines.push(`- **Estimated Timeline:** ${category.estimatedTimelineWeeks} weeks`);
	lines.push(`- **Risk Level:** ${depAnalysis.riskLevel}`);
	lines.push('');
	return lines.join('\n');
}

// --- Lookup helpers ---

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

function getPriorityDescription(priority: string): string {
	switch (priority) {
		case 'CRITICAL':
			return 'Requires immediate attention';
		case 'HIGH':
			return 'Should be fixed soon';
		case 'MEDIUM':
			return 'Plan for later';
		case 'LOW':
			return 'Optional improvement';
		default:
			return '';
	}
}

function getSolutionDescription(category: ViolationCategory): string {
	switch (category.folderName) {
		case '01-ui-modernization':
			return 'Migrate to Tailwind theme + optionally adopt Shadcn component library';
		case '02-service-layer-violations':
			return 'Refactor to feature-based architecture (move from services/ to feature/)';
		case '03-type-safety-violations':
			return 'Add justification comments or replace with Zod runtime validation';
		case '04-component-reuse':
			return 'Extract common button patterns to shared component (or accept as intentional)';
		default:
			return 'See detailed analysis below';
	}
}

function getDependencyRationale(category: ViolationCategory): string {
	switch (category.folderName) {
		case '02-service-layer-violations':
			return 'This is a code reorganization task, not a technology change. Moving files from src/lib/services/ to src/lib/<feature>/ requires no new libraries.';
		case '03-type-safety-violations':
			return 'Zod is already installed! No additional runtime validation libraries needed.';
		case '04-component-reuse':
			return 'If adopting Shadcn (from UI Modernization), these violations auto-resolve with Shadcn Button component.';
		default:
			return 'No additional dependencies required for this remediation.';
	}
}

function getUniqueFiles(violations: { filePath: string }[]): string[] {
	return [...new Set(violations.map((v) => v.filePath))];
}

function getRemediationOptions(
	category: ViolationCategory,
	_depAnalysis: DependencyAnalysis
): string {
	// This would be customized per category type
	// For now, return a generic template
	return `### Option A: Full Remediation

**Impact:** Resolves all ${category.violations.length} violations
**Timeline:** ${category.estimatedTimelineWeeks} weeks
**Risk:** ${_depAnalysis.riskLevel}

**Approach:**
1. Review all violations in detail
2. Apply fixes systematically (file-by-file or phase-by-phase)
3. Run tests after each change
4. Verify compliance with audit tool

---

### Option B: Incremental Remediation

**Impact:** Resolve violations gradually during normal development
**Timeline:** 2-3 months
**Risk:** LOW

**Approach:**
1. Fix violations as you touch related files
2. Add exemption annotations for deferred work
3. Track progress with periodic audits

---

### Option C: Constitutional Exemption

**Impact:** ZERO (no code changes)
**Timeline:** 15 minutes (documentation)
**Risk:** ZERO

**Approach:**
Add exemption to affected files:
\`\`\`typescript
// @constitutional-exemption: ${category.violations[0]?.articleReference || 'Article X'} issue:NNNN
// Justification: [Reason for exemption]
\`\`\``;
}

function getRiskAnalysis(_category: ViolationCategory, depAnalysis: DependencyAnalysis): string {
	const lines: string[] = [];

	lines.push(`### ${getRiskIcon(depAnalysis.riskLevel)} ${depAnalysis.riskLevel} RISK`);
	lines.push('');

	if (depAnalysis.newDependencies.length > 0) {
		lines.push('**Dependency Risks:**');
		lines.push(
			`- Adding ${depAnalysis.newDependencies.length} new packages to bundle (+${depAnalysis.bundleSizeImpactKB}KB)`
		);
		lines.push('- Version compatibility with existing dependencies');
		lines.push('- Potential transitive dependency conflicts');
		lines.push('');
		lines.push('**Mitigation:**');
		lines.push('- Run `npm install --dry-run` to check for conflicts before installation');
		lines.push('- Test thoroughly after installation');
		lines.push('- Monitor bundle size with `npm run build`');
	} else {
		lines.push('**No Dependency Risks** ✅');
		lines.push('');
		lines.push('This remediation requires zero new dependencies.');
	}

	return lines.join('\n');
}

function getRiskIcon(risk: string): string {
	switch (risk) {
		case 'CRITICAL':
			return '🔴';
		case 'HIGH':
			return '🟠';
		case 'MEDIUM':
			return '🟡';
		case 'LOW':
			return '🟢';
		default:
			return '';
	}
}

/** Build priority-specific recommendation with cost-benefit analysis */
function getRecommendation(category: ViolationCategory, depAnalysis: DependencyAnalysis): string {
	const lines: string[] = [];

	lines.push(`### ✅ **Recommended Approach for ${category.name}**`);
	lines.push('');
	lines.push(getPriorityGuidance(category));
	lines.push('');
	lines.push('**Cost-Benefit Analysis:**');
	lines.push(`- Dependencies: ${depAnalysis.totalCost}`);
	lines.push(`- Risk: ${depAnalysis.riskLevel}`);
	lines.push(`- Timeline: ${category.estimatedTimelineWeeks} weeks`);
	lines.push(`- Impact: Resolves ${category.violations.length} violations`);

	return lines.join('\n');
}

/** Return priority-specific guidance text for the recommendation section */
function getPriorityGuidance(category: ViolationCategory): string {
	const lines: string[] = [];

	if (category.priority === 'CRITICAL') {
		lines.push('**Priority:** Immediate attention required');
		lines.push('');
		lines.push(
			'**Recommendation:** Option A (Full Remediation) or Option C (Exemption with plan)'
		);
		lines.push('');
		lines.push(
			'CRITICAL violations should not be left unaddressed. Either fix them immediately or document why they are acceptable with a clear remediation timeline.'
		);
	} else if (category.priority === 'HIGH') {
		lines.push('**Priority:** Should fix soon');
		lines.push('');
		lines.push('**Recommendation:** Option A (Full Remediation) - High ROI');
		lines.push('');
		lines.push(
			`HIGH priority violations represent ${category.violations.length} issues that should be addressed. The estimated timeline of ${category.estimatedTimelineWeeks} weeks is reasonable for the impact gained.`
		);
	} else if (category.priority === 'MEDIUM') {
		lines.push('**Priority:** Plan for later');
		lines.push('');
		lines.push(
			'**Recommendation:** Option B (Incremental) - Balance pragmatism with improvement'
		);
		lines.push('');
		lines.push(
			'MEDIUM priority violations can be addressed incrementally. Fix them as you touch related code during normal feature development.'
		);
	} else {
		lines.push('**Priority:** Optional improvement');
		lines.push('');
		lines.push('**Recommendation:** Option C (Exemption) or Option B (Incremental)');
		lines.push('');
		lines.push(
			'LOW priority violations are not urgent. Focus on CRITICAL and HIGH priorities first.'
		);
	}

	return lines.join('\n');
}

function getNextSteps(category: ViolationCategory, depAnalysis: DependencyAnalysis): string {
	const lines: string[] = [];

	lines.push('### If Proceeding with Remediation:');
	lines.push('');
	lines.push('1. **Review this analysis** and choose an option (A, B, or C)');
	lines.push('2. **Create git branch:** `feature/${category.folderName}`');

	if (depAnalysis.installCommands.length > 0) {
		lines.push('3. **Install dependencies:**');
		lines.push('   ```bash');
		for (const cmd of depAnalysis.installCommands) {
			lines.push(`   ${cmd}`);
		}
		lines.push('   ```');
		lines.push('4. **Verify installation:**');
	} else {
		lines.push('3. **No installation needed** - ready to proceed');
		lines.push('4. **Verify baseline:**');
	}

	lines.push('   ```bash');
	for (const cmd of depAnalysis.verificationCommands) {
		lines.push(`   ${cmd}`);
	}
	lines.push('   ```');
	lines.push('5. **Begin implementation** following the chosen option');
	lines.push('6. **Re-run audit** after completion: `npm run constitutional-audit`');
	lines.push('');
	lines.push('### If Deferring Remediation:');
	lines.push('');
	lines.push('1. **Add exemption annotations** to affected files');
	lines.push('2. **Create GitHub issue** tracking the technical debt');
	lines.push('3. **Set timeline** for future remediation');
	lines.push('4. **Re-run audit** to verify exemptions applied correctly');

	return lines.join('\n');
}
