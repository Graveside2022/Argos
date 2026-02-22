import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { AuditTimeoutError } from '../../src/lib/constitution/types.js';

// Mock parseConstitution to return valid articles matching the Zod schema,
// avoiding dependency on the constitution.md file format which uses inline
// bold sections (**N.N Title**:) rather than the ### N.N Title headings
// the parser expects.
vi.mock('../../src/lib/constitution/constitution-parser.js', () => ({
	parseConstitution: vi.fn().mockResolvedValue(
		Array.from({ length: 12 }, (_, i) => {
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
			const titles = [
				'Comprehension & Inventory',
				'Code Quality',
				'Testing',
				'User Experience',
				'Performance',
				'Dependencies',
				'Debugging',
				'Operations & Security',
				'Spec-Kit Governance',
				'Reserved',
				'Reserved',
				'Reserved'
			];
			return {
				id: romanNumerals[i],
				number: i + 1,
				title: titles[i],
				sections: [
					{
						id: `${i + 1}.1`,
						articleId: romanNumerals[i],
						title: `${titles[i]} — Primary Section`,
						rules: [],
						examples: []
					}
				],
				forbiddenPatterns: [],
				priority: i === 8 ? 'CRITICAL' : i <= 2 ? 'HIGH' : 'LOW'
			};
		})
	)
}));

// Import after mock is set up
const { runAudit } = await import('../../src/lib/constitution/auditor.js');

// Use a temporary directory for report output to avoid polluting docs/reports
const testReportDir = join(process.cwd(), 'tests/constitution/fixtures/temp-reports');

describe('runAudit - Integration Tests', () => {
	it('should complete full audit within timeout', async () => {
		const options = {
			scope: 'full' as const,
			outputFormats: ['json' as const],
			timeoutMs: 60000,
			reportOutputDir: testReportDir,
			verbose: false
		};

		const report = await runAudit(options);

		expect(report).toBeDefined();
		expect(report.id).toBeDefined();
		expect(report.timestamp).toBeDefined();
		expect(report.executionDurationMs).toBeLessThan(60000);
		expect(report.articleScores).toHaveLength(12);
		expect(report.scope).toBe('full');
	});

	it('should handle article-specific scope', async () => {
		const options = {
			scope: 'article' as const,
			scopeFilter: 'Article II',
			outputFormats: ['json' as const],
			timeoutMs: 30000,
			reportOutputDir: testReportDir,
			verbose: false
		};

		const report = await runAudit(options);

		expect(report).toBeDefined();
		expect(report.scope).toBe('article');
		expect(report.scopeFilter).toBe('Article II');
	});

	it('should handle directory-specific scope', async () => {
		const options = {
			scope: 'directory' as const,
			scopeFilter: 'src/lib/constitution/',
			outputFormats: ['json' as const],
			timeoutMs: 30000,
			reportOutputDir: testReportDir,
			verbose: false
		};

		const report = await runAudit(options);

		expect(report).toBeDefined();
		expect(report.scope).toBe('directory');
	});

	it('should calculate compliance scores correctly', async () => {
		const options = {
			scope: 'full' as const,
			outputFormats: ['json' as const],
			timeoutMs: 60000,
			reportOutputDir: testReportDir,
			verbose: false
		};

		const report = await runAudit(options);

		expect(report.overallCompliancePercent).toBeGreaterThanOrEqual(0);
		expect(report.overallCompliancePercent).toBeLessThanOrEqual(100);

		report.articleScores.forEach((score) => {
			expect(score.scorePercent).toBeGreaterThanOrEqual(0);
			expect(score.scorePercent).toBeLessThanOrEqual(100);
			expect(score.totalChecks).toBeGreaterThanOrEqual(0);
			expect(score.passingChecks).toBeLessThanOrEqual(score.totalChecks);
			expect(score.failingChecks).toBe(score.totalChecks - score.passingChecks);
		});
	});

	it('should count violations by severity correctly', async () => {
		const options = {
			scope: 'full' as const,
			outputFormats: ['json' as const],
			timeoutMs: 60000,
			reportOutputDir: testReportDir,
			verbose: false
		};

		const report = await runAudit(options);

		const manualCount =
			report.criticalViolations +
			report.highViolations +
			report.mediumViolations +
			report.lowViolations;

		expect(manualCount).toBe(report.totalViolations);
	});

	it('should throw AuditTimeoutError on timeout', async () => {
		const options = {
			scope: 'full' as const,
			outputFormats: ['json' as const],
			timeoutMs: 1, // 1ms - will definitely timeout
			reportOutputDir: testReportDir,
			verbose: false
		};

		await expect(runAudit(options)).rejects.toThrow(AuditTimeoutError);
	}, 10000); // Increase test timeout to 10s
});
