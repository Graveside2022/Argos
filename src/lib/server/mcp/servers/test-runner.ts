#!/usr/bin/env node
/**
 * Test Runner MCP Server
 * Tools for running tests, checking coverage, and build validation
 */

import { exec } from 'child_process';
import { config } from 'dotenv';
import { promisify } from 'util';

import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';

const execAsync = promisify(exec);
config();

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
				const timeout = Math.min((args.timeout_seconds as number) || 300, 600);

				const commands: Record<string, string> = {
					unit: 'npm run test:unit',
					integration: 'npm run test:integration',
					e2e: 'npm run test:e2e',
					all: 'npm run test:all'
				};

				const command = commands[suite];
				if (!command) {
					return {
						status: 'ERROR',
						error: `Unknown test suite: ${suite}`
					};
				}

				try {
					const startTime = Date.now();
					const { stdout } = await execAsync(command, {
						timeout: timeout * 1000,
						cwd: '/home/kali/Documents/Argos/Argos'
					});

					const duration = Date.now() - startTime;

					// Parse test output (Vitest format)
					const passMatch = stdout.match(/(\d+) passed/);
					const failMatch = stdout.match(/(\d+) failed/);
					const totalMatch = stdout.match(/Test Files\s+(\d+)/);

					const passed = passMatch ? parseInt(passMatch[1]) : 0;
					const failed = failMatch ? parseInt(failMatch[1]) : 0;
					const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

					const allPassed = failed === 0;

					return {
						status: allPassed ? 'PASS' : 'FAIL',
						suite,
						duration_ms: duration,
						summary: {
							total_tests: total,
							passed,
							failed,
							pass_rate: total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : 'N/A'
						},
						output_sample: stdout.split('\n').slice(0, 50).join('\n'),
						recommendations: allPassed
							? ['✅ All tests passing']
							: [
									'⚠️ Tests failing',
									'💡 Review failed test output',
									'💡 Run specific test: npm test -- <test-file>'
								]
					};
				} catch (error) {
					const err = error as { stdout?: string; stderr?: string; message?: string };
					return {
						status: 'ERROR',
						suite,
						error: err.message || 'Test execution failed',
						output_sample: (err.stdout || err.stderr || '')
							.split('\n')
							.slice(0, 30)
							.join('\n'),
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
					const { stdout } = await execAsync('npm run typecheck', {
						cwd: '/home/kali/Documents/Argos/Argos',
						timeout: 120000
					});

					// Parse output for error count
					const errorMatch = stdout.match(/(\d+) errors?/i);
					const errorCount = errorMatch ? parseInt(errorMatch[1]) : 0;

					return {
						status: errorCount === 0 ? 'PASS' : 'FAIL',
						error_count: errorCount,
						output: stdout.split('\n').slice(0, 100).join('\n'),
						recommendations:
							errorCount === 0
								? ['✅ No type errors']
								: [
										`⚠️ ${errorCount} type errors found`,
										'💡 Review output for file locations',
										'💡 Fix errors before committing'
									]
					};
				} catch (error) {
					const err = error as { stdout?: string; message?: string };
					return {
						status: 'ERROR',
						error: err.message || 'Typecheck failed',
						output: (err.stdout || '').split('\n').slice(0, 50).join('\n')
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
				const command = fix ? 'npm run lint:fix' : 'npm run lint';

				try {
					const { stdout, stderr } = await execAsync(command, {
						cwd: '/home/kali/Documents/Argos/Argos',
						timeout: 60000
					});

					const output = stdout || stderr;
					const errorMatch = output.match(/(\d+) errors?/);
					const warningMatch = output.match(/(\d+) warnings?/);

					const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
					const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;

					return {
						status: errors === 0 ? 'PASS' : 'FAIL',
						errors,
						warnings,
						fixed: fix,
						output: output.split('\n').slice(0, 100).join('\n'),
						recommendations:
							errors === 0 && warnings === 0
								? ['✅ No lint issues']
								: [
										`${errors} errors, ${warnings} warnings`,
										fix
											? '💡 Some issues auto-fixed'
											: '💡 Run with fix: true to auto-fix',
										'💡 Review output for remaining issues'
									]
					};
				} catch (error) {
					const err = error as { stdout?: string; stderr?: string; message?: string };
					const output = err.stdout || err.stderr || '';
					const errorMatch = output.match(/(\d+) errors?/);
					const errors = errorMatch ? parseInt(errorMatch[1]) : 0;

					if (errors > 0) {
						return {
							status: 'FAIL',
							errors,
							warnings: 0,
							output: output.split('\n').slice(0, 100).join('\n'),
							recommendations: [
								`⚠️ ${errors} lint errors`,
								'💡 Fix errors before committing'
							]
						};
					}

					return {
						status: 'ERROR',
						error: err.message || 'Lint failed',
						output: output.split('\n').slice(0, 50).join('\n')
					};
				}
			}
		}
	];
}

const server = new TestRunner('argos-test-runner');
server.start().catch((error) => {
	console.error('[Test Runner] Fatal:', error);
	process.exit(1);
});
