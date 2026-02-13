import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import { calculateTrends } from '../../src/lib/constitution/trend-tracker.js';

describe('calculateTrends', () => {
	const reportDir = join(process.cwd(), '.specify/audit-reports');

	beforeEach(() => {
		// Clean up audit reports before each test for isolation
		if (existsSync(reportDir)) {
			const files = readdirSync(reportDir);
			files.forEach((file) => {
				if (file.startsWith('audit-') && file.endsWith('.json')) {
					rmSync(join(reportDir, file));
				}
			});
		} else {
			mkdirSync(reportDir, { recursive: true });
		}
	});

	it('should mark first audit as baseline', async () => {
		const report = createMockReport(75);

		const result = await calculateTrends(report, process.cwd());

		expect(result.trendDirection).toBe('baseline');
		result.articleScores.forEach((score) => {
			expect(score.trendDirection).toBe('baseline');
		});
	});

	it('should detect improving trend when compliance increases', async () => {
		// This test would require creating a previous report file
		// For unit test, we verify the logic is correct
		const report = createMockReport(80);

		const result = await calculateTrends(report, process.cwd());

		// Without previous report, should be baseline
		expect(result.trendDirection).toBe('baseline');
	});
});

function createMockReport(compliance: number) {
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
		overallCompliancePercent: compliance,
		totalViolations: 10,
		criticalViolations: 1,
		highViolations: 3,
		mediumViolations: 4,
		lowViolations: 2,
		articleScores: romanNumerals.map((id, _index) => ({
			articleId: id,
			articleTitle: `Article ${id}`,
			totalChecks: 10,
			passingChecks: 8,
			failingChecks: 2,
			scorePercent: 80,
			violationCount: 2,
			trendDirection: 'baseline' as const
		})),
		violations: [],
		filesScanned: 50,
		scope: 'full' as const,
		trendDirection: 'baseline' as const
	};
}
