import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { calculateTrends } from '../../src/lib/constitution/trend-tracker.js';

describe('calculateTrends', () => {
	// Use isolated temp directory so existing docs/reports/ audit files don't interfere
	const tempRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-trends');

	beforeEach(() => {
		mkdirSync(join(tempRoot, 'docs/reports'), { recursive: true });
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it('should mark first audit as baseline', async () => {
		const report = createMockReport(75);

		const result = await calculateTrends(report, tempRoot);

		expect(result.trendDirection).toBe('baseline');
		result.articleScores.forEach((score) => {
			expect(score.trendDirection).toBe('baseline');
		});
	});

	it('should detect improving trend when compliance increases', async () => {
		// Create a previous report with lower compliance
		const previousReport = createMockReport(60);
		writeFileSync(
			join(tempRoot, 'docs/reports/audit-2026-02-13-120000.json'),
			JSON.stringify(previousReport)
		);

		const currentReport = createMockReport(80);

		const result = await calculateTrends(currentReport, tempRoot);

		expect(result.trendDirection).toBe('improving');
	});

	it('should detect stable trend when compliance unchanged', async () => {
		const previousReport = createMockReport(80);
		writeFileSync(
			join(tempRoot, 'docs/reports/audit-2026-02-13-120000.json'),
			JSON.stringify(previousReport)
		);

		const currentReport = createMockReport(80);

		const result = await calculateTrends(currentReport, tempRoot);

		expect(result.trendDirection).toBe('stable');
	});

	it('should detect degrading trend when compliance decreases', async () => {
		const previousReport = createMockReport(90);
		writeFileSync(
			join(tempRoot, 'docs/reports/audit-2026-02-13-120000.json'),
			JSON.stringify(previousReport)
		);

		const currentReport = createMockReport(70);

		const result = await calculateTrends(currentReport, tempRoot);

		expect(result.trendDirection).toBe('degrading');
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
