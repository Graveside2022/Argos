/**
 * Performance Benchmark: Tool Execution Framework
 *
 * Measures performance characteristics of the tool execution system
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
	globalRegistry,
	globalExecutor,
	initializeToolExecutionFramework
} from '../../src/lib/server/agent/tool-execution';
import {
	exampleTools,
	handleCalculateDistance
} from '../../src/lib/server/agent/tool-execution/examples/example-tools';
import { InternalAdapter } from '../../src/lib/server/agent/tool-execution/adapters/internal-adapter';
import { globalRouter } from '../../src/lib/server/agent/tool-execution/router';

describe('Tool Execution Performance Benchmarks', () => {
	beforeAll(async () => {
		await initializeToolExecutionFramework();

		// Register example tools
		exampleTools.forEach((tool) => {
			globalRegistry.register(tool);
		});

		// Register internal handler
		const internalAdapter = globalRouter['adapters'].find(
			(a) => a.backendType === 'internal'
		) as InternalAdapter;
		if (internalAdapter) {
			internalAdapter['handlers'].set('calculateDistance', handleCalculateDistance);
		}
	});

	describe('Single Tool Execution', () => {
		it('should execute internal tool in < 10ms', async () => {
			const start = performance.now();

			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 0,
				lon1: 0,
				lat2: 1,
				lon2: 1
			});

			const duration = performance.now() - start;

			expect(result.status).toBe('success');
			expect(duration).toBeLessThan(10); // Should be very fast

			console.log(`Internal tool execution: ${duration.toFixed(2)}ms`);
		});

		it('should handle 100 sequential executions in < 1s', async () => {
			const start = performance.now();

			for (let i = 0; i < 100; i++) {
				await globalExecutor.execute('example.geo.distance', {
					lat1: i,
					lon1: i,
					lat2: i + 1,
					lon2: i + 1
				});
			}

			const duration = performance.now() - start;
			const avgPerExecution = duration / 100;

			expect(duration).toBeLessThan(1000);
			console.log(`100 sequential executions: ${duration.toFixed(2)}ms`);
			console.log(`Average per execution: ${avgPerExecution.toFixed(2)}ms`);
		}, 10000); // 10s timeout
	});

	describe('Parallel Execution', () => {
		it('should handle 100 parallel executions efficiently', async () => {
			const start = performance.now();

			const promises = Array.from({ length: 100 }, (_, i) =>
				globalExecutor.execute('example.geo.distance', {
					lat1: i,
					lon1: i,
					lat2: i + 1,
					lon2: i + 1
				})
			);

			const results = await Promise.all(promises);
			const duration = performance.now() - start;

			expect(results.every((r) => r.status === 'success')).toBe(true);
			expect(duration).toBeLessThan(500); // Should be much faster than sequential

			console.log(`100 parallel executions: ${duration.toFixed(2)}ms`);
			console.log(`Speedup vs sequential: ${(1000 / duration).toFixed(1)}x`);
		}, 10000);

		it('should handle 1000 parallel executions without crashing', async () => {
			const start = performance.now();

			const promises = Array.from({ length: 1000 }, (_, i) =>
				globalExecutor.execute('example.geo.distance', {
					lat1: i % 90,
					lon1: i % 180,
					lat2: (i + 1) % 90,
					lon2: (i + 1) % 180
				})
			);

			const results = await Promise.all(promises);
			const duration = performance.now() - start;

			expect(results.every((r) => r.status === 'success')).toBe(true);
			console.log(`1000 parallel executions: ${duration.toFixed(2)}ms`);
			console.log(`Average per execution: ${(duration / 1000).toFixed(2)}ms`);
		}, 30000); // 30s timeout
	});

	describe('Registry Performance', () => {
		it('should query registry in < 1ms', () => {
			const start = performance.now();

			const tools = globalRegistry.query({ namespace: 'example' });

			const duration = performance.now() - start;

			expect(tools.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(1);

			console.log(`Registry query: ${duration.toFixed(3)}ms`);
		});

		it('should handle 10000 registry lookups in < 100ms', () => {
			const start = performance.now();

			for (let i = 0; i < 10000; i++) {
				globalRegistry.get('example.geo.distance');
			}

			const duration = performance.now() - start;

			expect(duration).toBeLessThan(100);
			console.log(`10000 registry lookups: ${duration.toFixed(2)}ms`);
		});

		it('should search registry efficiently', () => {
			const start = performance.now();

			for (let i = 0; i < 1000; i++) {
				globalRegistry.query({ search: 'example' });
			}

			const duration = performance.now() - start;

			expect(duration).toBeLessThan(500);
			console.log(`1000 registry searches: ${duration.toFixed(2)}ms`);
		});
	});

	describe('Batch Execution Performance', () => {
		it('should batch execute 50 tools efficiently', async () => {
			const batch = Array.from({ length: 50 }, (_, i) => ({
				toolName: 'example.geo.distance',
				parameters: {
					lat1: i,
					lon1: i,
					lat2: i + 1,
					lon2: i + 1
				}
			}));

			const start = performance.now();
			const results = await globalExecutor.executeBatch(batch);
			const duration = performance.now() - start;

			expect(results.length).toBe(50);
			expect(results.every((r) => r.status === 'success')).toBe(true);

			console.log(`Batch execution (50 tools): ${duration.toFixed(2)}ms`);
			console.log(`Average per tool: ${(duration / 50).toFixed(2)}ms`);
		}, 10000);
	});

	describe('Memory Usage', () => {
		it('should not leak memory during repeated executions', async () => {
			// Get initial memory usage
			const memBefore = process.memoryUsage();

			// Execute 1000 operations
			for (let i = 0; i < 1000; i++) {
				await globalExecutor.execute('example.geo.distance', {
					lat1: 0,
					lon1: 0,
					lat2: 1,
					lon2: 1
				});
			}

			// Force garbage collection if available
			if (global.gc) {
				global.gc();
			}

			const memAfter = process.memoryUsage();

			const heapGrowth = memAfter.heapUsed - memBefore.heapUsed;
			const heapGrowthMB = heapGrowth / 1024 / 1024;

			console.log(`Heap growth after 1000 executions: ${heapGrowthMB.toFixed(2)} MB`);

			// Heap shouldn't grow more than 10MB for 1000 simple operations
			expect(heapGrowthMB).toBeLessThan(10);
		}, 30000);
	});

	describe('Throughput Metrics', () => {
		it('should measure operations per second', async () => {
			const duration = 1000; // 1 second
			const start = Date.now();
			let count = 0;

			// Execute as many operations as possible in 1 second
			while (Date.now() - start < duration) {
				await globalExecutor.execute('example.geo.distance', {
					lat1: 0,
					lon1: 0,
					lat2: 1,
					lon2: 1
				});
				count++;
			}

			const opsPerSecond = count;

			console.log(`Throughput: ${opsPerSecond} operations/second`);
			expect(opsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
		}, 5000);

		it('should measure parallel throughput', async () => {
			const duration = 1000; // 1 second
			const concurrency = 10;
			const start = Date.now();
			let totalCount = 0;

			// Run 10 concurrent workers
			const workers = Array.from({ length: concurrency }, async () => {
				let count = 0;
				while (Date.now() - start < duration) {
					await globalExecutor.execute('example.geo.distance', {
						lat1: 0,
						lon1: 0,
						lat2: 1,
						lon2: 1
					});
					count++;
				}
				return count;
			});

			const counts = await Promise.all(workers);
			totalCount = counts.reduce((sum, c) => sum + c, 0);

			const opsPerSecond = totalCount;

			console.log(`Parallel throughput (10 workers): ${opsPerSecond} operations/second`);
			expect(opsPerSecond).toBeGreaterThan(500); // At least 500 ops/sec with parallelism
		}, 5000);
	});

	describe('System Prompt Generation Performance', () => {
		it('should generate system prompt in < 10ms', async () => {
			const { getSystemPrompt } = await import('../../src/lib/server/agent/tools');

			const start = performance.now();

			const prompt = getSystemPrompt({
				selectedDevice: 'TEST',
				activeSignals: 42
			});

			const duration = performance.now() - start;

			expect(prompt.length).toBeGreaterThan(0);
			expect(duration).toBeLessThan(10);

			console.log(`System prompt generation: ${duration.toFixed(2)}ms`);
		});

		it('should generate 100 prompts in < 100ms', async () => {
			const { getSystemPrompt } = await import('../../src/lib/server/agent/tools');

			const start = performance.now();

			for (let i = 0; i < 100; i++) {
				getSystemPrompt({ activeSignals: i });
			}

			const duration = performance.now() - start;

			expect(duration).toBeLessThan(100);
			console.log(`100 system prompts: ${duration.toFixed(2)}ms`);
		});
	});
});
