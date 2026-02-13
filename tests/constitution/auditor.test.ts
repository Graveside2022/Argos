import { describe, expect, it } from 'vitest';

import { runAudit } from '../../src/lib/constitution/auditor.js';
import { AuditTimeoutError } from '../../src/lib/constitution/types.js';

describe('runAudit - Integration Tests', () => {
	it('should complete full audit within timeout', async () => {
		const options = {
			scope: 'full' as const,
			outputFormats: ['json' as const],
			timeoutMs: 60000,
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
			verbose: false
		};

		await expect(runAudit(options)).rejects.toThrow(AuditTimeoutError);
	}, 10000); // Increase test timeout to 10s
});
