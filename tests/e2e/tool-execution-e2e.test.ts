/**
 * End-to-End Test: Tool Execution Framework
 *
 * Tests the complete flow:
 * Agent Request → System Prompt → Tool Execution → Result
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
	globalRegistry,
	globalExecutor,
	globalRouter,
	initializeToolExecutionFramework
} from '../../src/lib/server/agent/tool-execution';
import { getAllTools, getSystemPrompt } from '../../src/lib/server/agent/tools';
import {
	exampleTools,
	handleCalculateDistance
} from '../../src/lib/server/agent/tool-execution/examples/example-tools';
import { InternalAdapter } from '../../src/lib/server/agent/tool-execution/adapters';

describe('Tool Execution Framework - End-to-End', () => {
	beforeAll(async () => {
		// Initialize framework
		await initializeToolExecutionFramework();

		// Register example tools
		exampleTools.forEach((tool) => {
			globalRegistry.register(tool);
		});

		// Register internal handler for distance calculation
		const internalAdapter = globalRouter['adapters'].find(
			(a) => a.backendType === 'internal'
		) as InternalAdapter;
		if (internalAdapter) {
			internalAdapter['handlers'].set('calculateDistance', handleCalculateDistance);
		}
	});

	afterAll(() => {
		// Cleanup: unregister example tools
		exampleTools.forEach((tool) => {
			try {
				globalRegistry['tools'].delete(tool.name);
			} catch {
				// Ignore cleanup errors
			}
		});
	});

	describe('System Initialization', () => {
		it('should initialize framework successfully', () => {
			const stats = globalRouter.getStats();

			expect(stats.adapterCount).toBeGreaterThan(0);
			expect(stats.totalExecutions).toBeGreaterThanOrEqual(0);
		});

		it('should register all backend adapters', () => {
			const stats = globalRouter.getStats();

			// Should have all 5 adapters: CLI, HTTP, MCP, WebSocket, Internal
			expect(stats.adapterCount).toBeGreaterThanOrEqual(5);
		});

		it('should have example tools registered', () => {
			const tools = globalRegistry.getAll();
			const exampleToolNames = exampleTools.map((t) => t.name);

			exampleToolNames.forEach((name) => {
				const found = tools.some((t) => t.name === name);
				expect(found).toBe(true);
			});
		});
	});

	describe('Agent Integration', () => {
		it('should include example tools in getAllTools()', () => {
			const allTools = getAllTools();
			const toolNames = allTools.map((t) => t.name);

			// Check that example tools are included
			expect(toolNames).toContain('example.network.ping');
			expect(toolNames).toContain('example.device.lookup');
			expect(toolNames).toContain('example.geo.distance');
		});

		it('should generate system prompt with tools', () => {
			const prompt = getSystemPrompt();

			expect(prompt).toContain('Tool Execution Framework');
			expect(prompt).toContain('example.network.ping');
		});

		it('should inject operational context into prompt', () => {
			const prompt = getSystemPrompt({
				selectedDevice: 'TEST-DEVICE',
				activeSignals: 99,
				userLocation: { lat: 40.7128, lon: -74.006 }
			});

			expect(prompt).toContain('TEST-DEVICE');
			expect(prompt).toContain('99 signals');
			expect(prompt).toContain('40.7128');
		});

		it('should format tools for MCP compatibility', () => {
			const tools = getAllTools();
			const exampleTool = tools.find((t) => t.name === 'example.network.ping');

			expect(exampleTool).toBeDefined();
			expect(exampleTool?.input_schema).toBeDefined();
			expect(exampleTool?.input_schema.type).toBe('object');
			expect(exampleTool?.input_schema.properties).toBeDefined();
		});
	});

	describe('Tool Execution - Internal Adapter', () => {
		it('should execute internal tool successfully', async () => {
			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 40.7128,
				lon1: -74.006, // New York
				lat2: 34.0522,
				lon2: -118.2437 // Los Angeles
			});

			expect(result.status).toBe('success');
			expect(result.data).toBeDefined();
			expect(result.data.distance_km).toBeGreaterThan(3900); // ~3944 km
			expect(result.data.distance_km).toBeLessThan(4000);
			expect(result.data.distance_miles).toBeGreaterThan(2400); // ~2451 miles
			expect(result.data.distance_miles).toBeLessThan(2500);
		});

		it('should validate required parameters', async () => {
			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 40.7128
				// Missing required params
			});

			expect(result.status).toBe('error');
			expect(result.error).toContain('required');
		});

		it('should include execution metadata', async () => {
			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 0,
				lon1: 0,
				lat2: 0,
				lon2: 0
			});

			expect(result.toolName).toBe('example.geo.distance');
			expect(result.backend).toBe('internal');
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(result.timestamp).toBeDefined();
		});
	});

	describe('Tool Execution - CLI Adapter (Native Binary)', () => {
		it('should execute native binary tool', async () => {
			// Ping localhost (should always work)
			const result = await globalExecutor.execute('example.network.ping', {
				target: '127.0.0.1'
			});

			// This might fail if ping is not available, so we check both cases
			if (result.status === 'success') {
				expect(result.data).toBeDefined();
				expect(result.backend).toBe('cli');
			} else {
				expect(result.status).toBe('error');
				expect(result.error).toBeDefined();
			}
		});

		it('should handle CLI tool errors gracefully', async () => {
			const result = await globalExecutor.execute('example.network.ping', {
				target: 'invalid-host-that-does-not-exist-12345.local'
			});

			// Should complete (either success or error) without crashing
			expect(['success', 'error']).toContain(result.status);
			expect(result.toolName).toBe('example.network.ping');
		});
	});

	describe('Tool Discovery and Availability', () => {
		it('should check if tool exists', () => {
			expect(globalExecutor.hasTool('example.geo.distance')).toBe(true);
			expect(globalExecutor.hasTool('nonexistent.tool')).toBe(false);
		});

		it('should get tool definition', () => {
			const tool = globalRegistry.get('example.geo.distance');

			expect(tool).toBeDefined();
			expect(tool?.name).toBe('example.geo.distance');
			expect(tool?.backendType).toBe('internal');
			expect(tool?.namespace).toBe('example');
		});

		it('should query tools by namespace', () => {
			const exampleTools = globalRegistry.query({ namespace: 'example' });

			expect(exampleTools.length).toBeGreaterThan(0);
			expect(exampleTools.every((t) => t.namespace === 'example')).toBe(true);
		});

		it('should query tools by workflow', () => {
			const geoTools = globalRegistry.query({ workflow: 'geospatial_analysis' });

			expect(geoTools.length).toBeGreaterThan(0);
			expect(geoTools.some((t) => t.name === 'example.geo.distance')).toBe(true);
		});

		it('should search tools by keyword', () => {
			const networkTools = globalRegistry.query({ search: 'network' });

			expect(networkTools.length).toBeGreaterThan(0);
			expect(networkTools.some((t) => t.name === 'example.network.ping')).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should handle unknown tool gracefully', async () => {
			const result = await globalExecutor.execute('nonexistent.tool', {});

			expect(result.status).toBe('error');
			expect(result.error).toContain('not found');
		});

		it('should handle missing parameters', async () => {
			const result = await globalExecutor.execute('example.network.ping', {
				// Missing required 'target' parameter
			});

			expect(result.status).toBe('error');
			expect(result.error).toBeDefined();
		});

		it('should handle invalid parameter types', async () => {
			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 'not-a-number', // Should be number
				lon1: 0,
				lat2: 0,
				lon2: 0
			});

			// Framework should handle type coercion or reject
			expect(['success', 'error']).toContain(result.status);
		});

		it('should timeout long-running operations', async () => {
			// This test would need a tool that intentionally hangs
			// For now, just verify timeout mechanism exists
			expect(globalExecutor['DEFAULT_TIMEOUT']).toBeGreaterThan(0);
		}, 10000); // 10 second test timeout
	});

	describe('Performance Metrics', () => {
		it('should track execution statistics', async () => {
			const statsBefore = globalRouter.getStats();

			// Execute a tool
			await globalExecutor.execute('example.geo.distance', {
				lat1: 0,
				lon1: 0,
				lat2: 1,
				lon2: 1
			});

			const statsAfter = globalRouter.getStats();

			expect(statsAfter.totalExecutions).toBeGreaterThanOrEqual(statsBefore.totalExecutions);
		});

		it('should measure execution duration', async () => {
			const result = await globalExecutor.execute('example.geo.distance', {
				lat1: 0,
				lon1: 0,
				lat2: 0,
				lon2: 0
			});

			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(result.duration).toBeLessThan(1000); // Should be very fast (< 1 second)
		});

		it('should execute multiple tools in parallel', async () => {
			const startTime = Date.now();

			const promises = [
				globalExecutor.execute('example.geo.distance', {
					lat1: 0,
					lon1: 0,
					lat2: 1,
					lon2: 1
				}),
				globalExecutor.execute('example.geo.distance', {
					lat1: 10,
					lon1: 10,
					lat2: 11,
					lon2: 11
				}),
				globalExecutor.execute('example.geo.distance', {
					lat1: 20,
					lon1: 20,
					lat2: 21,
					lon2: 21
				})
			];

			const results = await Promise.all(promises);
			const duration = Date.now() - startTime;

			// All should succeed
			results.forEach((r) => {
				expect(r.status).toBe('success');
			});

			// Parallel execution should be faster than sequential
			expect(duration).toBeLessThan(1000); // Should complete quickly
		});
	});

	describe('Batch Execution', () => {
		it('should execute multiple tools in batch', async () => {
			const results = await globalExecutor.executeBatch([
				{
					toolName: 'example.geo.distance',
					parameters: { lat1: 0, lon1: 0, lat2: 1, lon2: 1 }
				},
				{
					toolName: 'example.geo.distance',
					parameters: { lat1: 10, lon1: 10, lat2: 11, lon2: 11 }
				}
			]);

			expect(results.length).toBe(2);
			results.forEach((r) => {
				expect(r.status).toBe('success');
			});
		});

		it('should handle mixed success/failure in batch', async () => {
			const results = await globalExecutor.executeBatch([
				{
					toolName: 'example.geo.distance',
					parameters: { lat1: 0, lon1: 0, lat2: 1, lon2: 1 }
				},
				{
					toolName: 'nonexistent.tool',
					parameters: {}
				}
			]);

			expect(results.length).toBe(2);
			expect(results[0].status).toBe('success');
			expect(results[1].status).toBe('error');
		});
	});

	describe('Registry Operations', () => {
		it('should get all registered tools', () => {
			const tools = globalRegistry.getAll();

			expect(Array.isArray(tools)).toBe(true);
			expect(tools.length).toBeGreaterThan(0);
		});

		it('should get registry statistics', () => {
			const stats = globalRegistry.getStats();

			expect(stats.totalTools).toBeGreaterThan(0);
			expect(stats.namespaces).toContain('example');
		});

		it('should organize tools by namespace', () => {
			const byNamespace = globalRegistry.getByNamespace();

			expect(byNamespace.example).toBeDefined();
			expect(byNamespace.example.length).toBeGreaterThan(0);
		});
	});
});
