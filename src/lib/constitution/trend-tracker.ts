import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

import { type AuditReport, type ComplianceScore, type TrendDirection } from './types.js';

/**
 * Calculate trend direction by comparing to previous audit
 *
 * @param currentReport - Current audit report
 * @param projectRoot - Project root directory
 * @returns Updated report with trend directions
 */
export async function calculateTrends(
	currentReport: AuditReport,
	projectRoot: string
): Promise<AuditReport> {
	const previousReport = await loadPreviousReport(projectRoot);

	if (!previousReport) {
		// First audit - baseline
		return {
			...currentReport,
			trendDirection: 'baseline',
			articleScores: currentReport.articleScores.map((score) => ({
				...score,
				trendDirection: 'baseline'
			}))
		};
	}

	// Calculate overall trend
	const overallTrend = determineTrendDirection(
		currentReport.overallCompliancePercent,
		previousReport.overallCompliancePercent
	);

	// Calculate article-level trends
	const articleScores = currentReport.articleScores.map((currentScore) => {
		const previousScore = previousReport.articleScores.find(
			(s: ComplianceScore) => s.articleId === currentScore.articleId
		);

		if (!previousScore) {
			return { ...currentScore, trendDirection: 'baseline' as TrendDirection };
		}

		const trendDirection = determineTrendDirection(
			currentScore.scorePercent,
			previousScore.scorePercent
		);

		return {
			...currentScore,
			trendDirection,
			previousScorePercent: previousScore.scorePercent
		};
	});

	return {
		...currentReport,
		trendDirection: overallTrend,
		articleScores
	};
}

/**
 * Determine trend direction from score comparison
 */
function determineTrendDirection(current: number, previous: number): TrendDirection {
	if (current > previous) return 'improving';
	if (current < previous) return 'degrading';
	return 'stable';
}

/**
 * Load most recent previous audit report
 */
async function loadPreviousReport(projectRoot: string): Promise<AuditReport | null> {
	const reportDir = join(projectRoot, 'docs/reports');

	try {
		const files = await readdir(reportDir);
		const auditFiles = files
			.filter((f) => f.startsWith('audit-') && f.endsWith('.json'))
			.sort()
			.reverse();

		if (auditFiles.length === 0) {
			return null;
		}

		// Load most recent report (skip if it's the current execution)
		for (const file of auditFiles) {
			const content = await readFile(join(reportDir, file), 'utf-8');
			const report = JSON.parse(content);
			return report;
		}

		return null;
	} catch {
		return null;
	}
}
