import { writeFile } from 'fs/promises';
import { join } from 'path';

import { type AuditReport, type ReportFormat } from './types.js';

/**
 * Generate formatted report from audit results
 *
 * @param report - Audit report to format
 * @param format - Output format (json, markdown, terminal)
 * @returns Formatted report string
 */
export function generateReport(report: AuditReport, format: ReportFormat): string {
	switch (format) {
		case 'json':
			return generateJSONReport(report);
		case 'markdown':
			return generateMarkdownReport(report);
		case 'terminal':
			return generateTerminalReport(report);
		default:
			throw new Error(`Unknown report format: ${format}`);
	}
}

/**
 * Save report to file
 */
export async function saveReport(
	report: AuditReport,
	format: ReportFormat,
	outputDir: string
): Promise<string> {
	const content = generateReport(report, format);
	const timestamp = new Date()
		.toISOString()
		.replace(/[:.]/g, '-')
		.split('T')
		.join('-')
		.split('-')
		.slice(0, 6)
		.join('-');
	const filename = `audit-${timestamp}.${format === 'json' ? 'json' : 'md'}`;
	const filepath = join(outputDir, filename);

	await writeFile(filepath, content, 'utf-8');
	return filepath;
}

// ============================================================================
// JSON FORMATTER
// ============================================================================

function generateJSONReport(report: AuditReport): string {
	return JSON.stringify(report, null, 2);
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function generateMarkdownReport(report: AuditReport): string {
	const lines: string[] = [];

	// Header
	lines.push('# Constitutional Compliance Audit Report');
	lines.push('');
	lines.push(`**Date**: ${new Date(report.timestamp).toLocaleString()}`);
	lines.push(`**Duration**: ${(report.executionDurationMs / 1000).toFixed(2)}s`);
	lines.push(`**Constitution Version**: ${report.constitutionVersion}`);
	lines.push('');

	// Summary
	lines.push('## Summary');
	lines.push('');
	lines.push(
		`- **Overall Compliance**: ${report.overallCompliancePercent}% (${report.trendDirection})`
	);
	lines.push(`- **Files Scanned**: ${report.filesScanned}`);
	lines.push(`- **Total Violations**: ${report.totalViolations}`);
	lines.push(`  - 🔴 CRITICAL: ${report.criticalViolations}`);
	lines.push(`  - 🟠 HIGH: ${report.highViolations}`);
	lines.push(`  - 🟡 MEDIUM: ${report.mediumViolations}`);
	lines.push(`  - ⚪ LOW: ${report.lowViolations}`);
	lines.push('');

	// Article Scores
	lines.push('## Article Compliance');
	lines.push('');
	lines.push('| Article | Score | Violations | Trend |');
	lines.push('|---------|-------|------------|-------|');

	for (const score of report.articleScores) {
		const trendIcon = getTrendIcon(score.trendDirection);
		lines.push(
			`| ${score.articleId}. ${score.articleTitle} | ${score.scorePercent}% | ${score.violationCount} | ${trendIcon} |`
		);
	}
	lines.push('');

	// Violations by Severity
	if (report.violations.length > 0) {
		lines.push('## Violations');
		lines.push('');

		for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
			const severityViolations = report.violations.filter((v) => v.severity === severity);
			if (severityViolations.length === 0) continue;

			const icon = getSeverityIcon(severity);
			lines.push(`### ${icon} ${severity} (${severityViolations.length})`);
			lines.push('');

			for (const violation of severityViolations.slice(0, 10)) {
				// Limit to 10 per severity
				lines.push(`**${violation.filePath}:${violation.lineNumber}**`);
				lines.push(`- Article: ${violation.articleReference}`);
				lines.push(`- Rule: ${violation.ruleViolated}`);
				lines.push(`- Fix: ${violation.suggestedFix || 'Review violation'}`);
				if (violation.isPreExisting) {
					lines.push(`- ⚠️ Pre-existing (since ${violation.commitDate?.split('T')[0]})`);
				}
				lines.push('');
			}
		}
	}

	return lines.join('\n');
}

// ============================================================================
// TERMINAL FORMATTER (with ANSI colors)
// ============================================================================

function generateTerminalReport(report: AuditReport): string {
	const lines: string[] = [];

	// ANSI color codes
	const colors = {
		reset: '\x1b[0m',
		bold: '\x1b[1m',
		red: '\x1b[31m',
		yellow: '\x1b[33m',
		green: '\x1b[32m',
		blue: '\x1b[34m',
		cyan: '\x1b[36m',
		gray: '\x1b[90m'
	};

	// Header
	lines.push('');
	lines.push(`${colors.bold}${colors.cyan}🔍 Constitutional Compliance Audit${colors.reset}`);
	lines.push(`${colors.gray}${new Date(report.timestamp).toLocaleString()}${colors.reset}`);
	lines.push('');

	// Summary
	const complianceColor =
		report.overallCompliancePercent >= 80
			? colors.green
			: report.overallCompliancePercent >= 60
				? colors.yellow
				: colors.red;

	lines.push(
		`${colors.bold}📊 Overall Compliance: ${complianceColor}${report.overallCompliancePercent}%${colors.reset} ${getTrendIcon(report.trendDirection)}`
	);
	lines.push(`⏱  Execution Time: ${(report.executionDurationMs / 1000).toFixed(2)}s`);
	lines.push(`📁 Files Scanned: ${report.filesScanned}`);
	lines.push('');

	// Violations
	lines.push(
		`🔴 CRITICAL: ${colors.red}${colors.bold}${report.criticalViolations}${colors.reset}`
	);
	lines.push(`🟠 HIGH: ${colors.yellow}${report.highViolations}${colors.reset}`);
	lines.push(`🟡 MEDIUM: ${report.mediumViolations}`);
	lines.push(`⚪ LOW: ${colors.gray}${report.lowViolations}${colors.reset}`);
	lines.push('');

	// Top violations
	if (report.violations.length > 0) {
		const criticalViolations = report.violations.filter((v) => v.severity === 'CRITICAL');

		if (criticalViolations.length > 0) {
			lines.push(`${colors.bold}━━━ CRITICAL Violations ━━━${colors.reset}`);
			lines.push('');

			for (const violation of criticalViolations.slice(0, 5)) {
				lines.push(
					`${colors.red}🔴 [${violation.filePath}:${violation.lineNumber}]${colors.reset}`
				);
				lines.push(`   ${violation.articleReference}: ${violation.ruleViolated}`);
				lines.push(
					`   ${colors.cyan}Fix: ${violation.suggestedFix || 'Review violation'}${colors.reset}`
				);
				lines.push('');
			}
		}
	}

	// Article Summary
	lines.push(`${colors.bold}━━━ Article Compliance Summary ━━━${colors.reset}`);
	lines.push('');

	for (const score of report.articleScores) {
		const scoreColor =
			score.scorePercent === 100
				? colors.green
				: score.scorePercent >= 80
					? colors.yellow
					: colors.red;

		const trendIcon = getTrendIcon(score.trendDirection);
		lines.push(
			`  ${scoreColor}${score.scorePercent.toString().padStart(3)}%${colors.reset} Article ${score.articleId} — ${score.articleTitle} ${trendIcon}`
		);
	}

	lines.push('');
	lines.push(`${colors.gray}Full report saved to docs/reports/${colors.reset}`);
	lines.push('');

	return lines.join('\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSeverityIcon(severity: string): string {
	const icons: Record<string, string> = {
		CRITICAL: '🔴',
		HIGH: '🟠',
		MEDIUM: '🟡',
		LOW: '⚪'
	};
	return icons[severity] || '⚫';
}

function getTrendIcon(trend: string): string {
	const icons: Record<string, string> = {
		improving: '📈',
		stable: '➡️',
		degrading: '📉',
		baseline: '🆕'
	};
	return icons[trend] || '—';
}
