#!/usr/bin/env node
/**
 * Test Runner MCP Server
 * Tools for running tests, checking coverage, and build validation
 */

import { config } from 'dotenv';

import { execFileAsync } from '$lib/server/exec';
import { logger } from '$lib/utils/logger';

import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
config();

/** Map suite name to npm script. */
const SUITE_SCRIPTS: Record<string, string> = {
	unit: 'test:unit',
	integration: 'test:integration',
	e2e: 'test:e2e',
	all: 'test:all'
};

interface VitestResult {
	passed: number;
	failed: number;
	total: number;
}

/** Parse Vitest output for pass/fail/total counts. */
function parseVitestOutput(stdout: string): VitestResult {
	const passMatch = stdout.match(/(\d+) passed/);
	const failMatch = stdout.match(/(\d+) failed/);
	const totalMatch = stdout.match(/Test Files\s+(\d+)/);
	const passed = passMatch ? parseInt(passMatch[1]) : 0;
	const failed = failMatch ? parseInt(failMatch[1]) : 0;
	const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;
	return { passed, failed, total };
}

/** Generate test result recommendations. */
function buildTestRecs(allPassed: boolean): string[] {
	if (allPassed) return ['✅ All tests passing'];
	return [
		'⚠️ Tests failing',
		'💡 Review failed test output',
		'💡 Run specific test: npm test -- <test-file>'
	];
}

/** Extract error count from typecheck/lint output. */
function extractErrorCount(output: string): number {
	const match = output.match(/(\d+) errors?/i);
	return match ? parseInt(match[1]) : 0;
}

/** Extract warning count from lint output. */
function extractWarningCount(output: string): number {
	const match = output.match(/(\d+) warnings?/);
	return match ? parseInt(match[1]) : 0;
}

/** Generate typecheck recommendations. */
function buildTypecheckRecs(errorCount: number): string[] {
	if (errorCount === 0) return ['✅ No type errors'];
	return [
		`⚠️ ${errorCount} type errors found`,
		'💡 Review output for file locations',
		'💡 Fix errors before committing'
	];
}

/** Generate lint recommendations. */
function buildLintRecs(errors: number, warnings: number, fix: boolean): string[] {
	if (errors === 0 && warnings === 0) return ['✅ No lint issues'];
	const fixTip = fix ? '💡 Some issues auto-fixed' : '💡 Run with fix: true to auto-fix';
	return [
		`${errors} errors, ${warnings} warnings`,
		fixTip,
		'💡 Review output for remaining issues'
	];
}

/** Truncate output to first N lines. */
function truncateOutput(output: string, lines: number): string {
	return output.split('\n').slice(0, lines).join('\n');
}

/** Get combined stdout/stderr from exec error. */
function getErrorOutput(err: { stdout?: string; stderr?: string }): string {
	return err.stdout || err.stderr || '';
}

/** Format pass rate percentage. */
function formatPassRate(passed: number, total: number): string {
	return total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : 'N/A';
}

/** Resolve timeout with default and max cap. */
function resolveTimeout(raw: unknown): number {
	return Math.min((raw as number) || 300, 600);
}

/** Build lint error result from catch block output. */
function buildLintErrorResult(err: {
	stdout?: string;
	stderr?: string;
	message?: string;
}): Record<string, unknown> {
	const output = getErrorOutput(err);
	const errors = extractErrorCount(output);
	if (errors > 0) {
		return {
			status: 'FAIL',
			errors,
			warnings: 0,
			output: truncateOutput(output, 100),
			recommendations: [`⚠️ ${errors} lint errors`, '💡 Fix errors before committing']
		};
	}
	return {
		status: 'ERROR',
		error: err.message ?? 'Lint failed',
		output: truncateOutput(output, 50)
	};
}

/** Resolve lint script name from fix flag. */
function lintScript(fix: boolean): string {
	return fix ? 'lint:fix' : 'lint';
}

class TestRunner extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'run_tests',
			description:
				'Run test suite (unit/integration/e2e/all). Returns pass/fail status, test counts, and failed test details. Use after code changes to verify functionality.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					suite: {
						type: 'string',
						description: 'Test suite to run',
						enum: ['unit', 'integration', 'e2e', 'all']
					},
					timeout_seconds: {
						type: 'number',
						description: 'Max runtime (default: 300, max: 600)'
					}
				},
				required: ['suite']
			},
			execute: async (args: Record<string, unknown>) => {
				const suite = args.suite as string;
				const timeout = resolveTimeout(args.timeout_seconds);
				const script = SUITE_SCRIPTS[suite];
				if (!script) {
					return { status: 'ERROR', error: `Unknown test suite: ${suite}` };
				}

				try {
					const startTime = Date.now();
					const { stdout } = await execFileAsync('/usr/bin/npm', ['run', script], {
						timeout: timeout * 1000,
						cwd: process.cwd()
					});
					const { passed, failed, total } = parseVitestOutput(stdout);

					return {
						status: failed === 0 ? 'PASS' : 'FAIL',
						suite,
						duration_ms: Date.now() - startTime,
						summary: {
							total_tests: total,
							passed,
							failed,
							pass_rate: formatPassRate(passed, total)
						},
						output_sample: truncateOutput(stdout, 50),
						recommendations: buildTestRecs(failed === 0)
					};
				} catch (error) {
					const err = error as { stdout?: string; stderr?: string; message?: string };
					return {
						status: 'ERROR',
						suite,
						error: err.message ?? 'Test execution failed',
						output_sample: truncateOutput(getErrorOutput(err), 30),
						recommendations: [
							'🔴 Test execution error',
							'💡 Check test syntax and imports',
							'💡 Verify test environment setup'
						]
					};
				}
			}
		},
		{
			name: 'run_typecheck',
			description:
				'Run TypeScript type checking (svelte-check). Returns type errors with file locations. Use after TypeScript changes to catch type issues.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				try {
					const { stdout } = await execFileAsync('/usr/bin/npm', ['run', 'typecheck'], {
						cwd: process.cwd(),
						timeout: 120000
					});
					const errorCount = extractErrorCount(stdout);

					return {
						status: errorCount === 0 ? 'PASS' : 'FAIL',
						error_count: errorCount,
						output: truncateOutput(stdout, 100),
						recommendations: buildTypecheckRecs(errorCount)
					};
				} catch (error) {
					const err = error as { stdout?: string; message?: string };
					return {
						status: 'ERROR',
						error: err.message || 'Typecheck failed',
						output: truncateOutput(err.stdout || '', 50)
					};
				}
			}
		},
		{
			name: 'run_lint',
			description:
				'Run ESLint checks. Returns lint errors and warnings with file locations. Use before committing to catch code style issues.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					fix: {
						type: 'boolean',
						description: 'Auto-fix issues (default: false)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const fix = args.fix === true;

				try {
					const { stdout, stderr } = await execFileAsync(
						'/usr/bin/npm',
						['run', lintScript(fix)],
						{
							cwd: process.cwd(),
							timeout: 60000
						}
					);
					const output = stdout || stderr;
					const errors = extractErrorCount(output);
					const warnings = extractWarningCount(output);

					return {
						status: errors === 0 ? 'PASS' : 'FAIL',
						errors,
						warnings,
						fixed: fix,
						output: truncateOutput(output, 100),
						recommendations: buildLintRecs(errors, warnings, fix)
					};
				} catch (error) {
					return buildLintErrorResult(
						error as { stdout?: string; stderr?: string; message?: string }
					);
				}
			}
		}
	];
}

const server = new TestRunner('argos-test-runner');
server.start().catch((error) => {
	logger.error('Test Runner fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
