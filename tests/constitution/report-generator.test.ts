import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import { generateReport } from '../../src/lib/constitution/report-generator.js';

describe('generateReport', () => {
	const mockReport = createMockReport();

	it('should generate valid JSON report', () => {
		const json = generateReport(mockReport, 'json');

		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json);
		expect(parsed.overallCompliancePercent).toBe(75);
		expect(parsed.totalViolations).toBe(10);
	});

	it('should generate markdown report with headers', () => {
		const markdown = generateReport(mockReport, 'markdown');

		expect(markdown).toContain('# Constitutional Compliance Audit Report');
		expect(markdown).toContain('## Summary');
		expect(markdown).toContain('## Article Compliance');
		expect(markdown).toContain('Overall Compliance');
	});

	it('should generate terminal report with ANSI colors', () => {
		const terminal = generateReport(mockReport, 'terminal');

		expect(terminal).toContain('Constitutional Compliance Audit');
		expect(terminal).toContain('📊 Overall Compliance');
		expect(terminal).toContain('\x1b['); // ANSI escape code
	});

	it('should include violation details in markdown', () => {
		const markdown = generateReport(mockReport, 'markdown');

		expect(markdown).toContain('src/lib/test.ts');
		expect(markdown).toContain('Article II §2.1');
	});

	it('should include severity icons in terminal output', () => {
		const terminal = generateReport(mockReport, 'terminal');

		expect(terminal).toContain('🔴 CRITICAL');
		expect(terminal).toContain('🟠 HIGH');
		expect(terminal).toContain('🟡 MEDIUM');
		expect(terminal).toContain('⚪ LOW');
	});
});

function createMockReport() {
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

	return {
		id: randomUUID(),
		timestamp: new Date().toISOString(),
		constitutionVersion: '2.0.0',
		executionDurationMs: 5000,
		overallCompliancePercent: 75,
		totalViolations: 10,
		criticalViolations: 1,
		highViolations: 3,
		mediumViolations: 4,
		lowViolations: 2,
		articleScores: romanNumerals.map((id) => ({
			articleId: id,
			articleTitle: `Article ${id}`,
			totalChecks: 10,
			passingChecks: 8,
			failingChecks: 2,
			scorePercent: 80,
			violationCount: 2,
			trendDirection: 'baseline' as const
		})),
		violations: [
			{
				id: randomUUID(),
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.1',
				ruleViolated: 'No any type',
				filePath: 'src/lib/test.ts',
				lineNumber: 42,
				violationType: 'any-type',
				suggestedFix: 'Replace any with unknown',
				isPreExisting: false,
				exemptionStatus: 'none' as const
			}
		],
		filesScanned: 50,
		scope: 'full' as const,
		trendDirection: 'baseline' as const
	};
}
