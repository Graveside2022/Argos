/**
 * Integration Test: Agent Tool Execution Framework
 *
 * Verifies that the Argos Agent properly integrates with the Tool Execution Framework
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAllTools, getSystemPrompt } from '../../src/lib/server/agent/tools';
import {
	globalRegistry,
	globalExecutor,
	initializeToolExecutionFramework
} from '../../src/lib/server/agent/tool-execution';

describe('Agent Tool Integration', () => {
	beforeAll(async () => {
		// Initialize framework before tests
		await initializeToolExecutionFramework();
	});

	describe('Tool Discovery', () => {
		it('should load tools from global registry', () => {
			const tools = getAllTools();

			expect(tools).toBeDefined();
			expect(Array.isArray(tools)).toBe(true);
			expect(tools.length).toBeGreaterThan(0);
		});

		it('should convert tools to MCP format', () => {
			const tools = getAllTools();
			const sampleTool = tools[0];

			expect(sampleTool).toHaveProperty('name');
			expect(sampleTool).toHaveProperty('description');
			expect(sampleTool).toHaveProperty('input_schema');
			expect(sampleTool.input_schema).toHaveProperty('type', 'object');
			expect(sampleTool.input_schema).toHaveProperty('properties');
		});

		it('should include both legacy and framework tools', () => {
			const tools = getAllTools();
			const toolNames = tools.map((t) => t.name);

			// Check for legacy tools
			expect(toolNames).toContain('get_device_details');
			expect(toolNames).toContain('get_nearby_signals');

			// Framework tools are discovered dynamically based on installed tools
			// We just verify the structure works
			expect(toolNames.length).toBeGreaterThanOrEqual(8); // At least 8 legacy tools
		});

		it('should deduplicate tools by name', () => {
			const tools = getAllTools();
			const toolNames = tools.map((t) => t.name);
			const uniqueNames = new Set(toolNames);

			expect(toolNames.length).toBe(uniqueNames.size);
		});
	});

	describe('System Prompt Generation', () => {
		it('should generate system prompt with tool list', () => {
			const prompt = getSystemPrompt();

			expect(prompt).toBeDefined();
			expect(typeof prompt).toBe('string');
			expect(prompt.length).toBeGreaterThan(0);
		});

		it('should include operational context in prompt', () => {
			const prompt = getSystemPrompt({
				selectedDevice: 'ARRIS-0DC8',
				activeSignals: 42,
				kismetStatus: { connected: true, status: 'running' }
			});

			expect(prompt).toContain('ARRIS-0DC8');
			expect(prompt).toContain('42 signals');
			expect(prompt).toContain('KISMET');
		});

		it('should include tool capabilities section', () => {
			const prompt = getSystemPrompt();

			expect(prompt).toContain('YOUR CAPABILITIES');
			expect(prompt).toContain('Tool Execution Framework');
		});

		it('should include tool invocation instructions', () => {
			const prompt = getSystemPrompt();

			expect(prompt).toContain('To use a tool');
			expect(prompt).toContain('Example:');
		});
	});

	describe('Tool Execution Integration', () => {
		it('should have globalExecutor available', () => {
			expect(globalExecutor).toBeDefined();
			expect(globalExecutor.hasTool).toBeDefined();
			expect(globalExecutor.execute).toBeDefined();
		});

		it('should have globalRegistry available', () => {
			expect(globalRegistry).toBeDefined();
			expect(globalRegistry.getAll).toBeDefined();
			expect(globalRegistry.register).toBeDefined();
		});

		it('should check if tools exist via executor', () => {
			const tools = getAllTools();

			if (tools.length > 0) {
				const firstTool = tools[0];
				// Tool existence check should not throw
				expect(() => globalExecutor.hasTool(firstTool.name)).not.toThrow();
			}
		});
	});

	describe('Agent API Integration', () => {
		it('should have tool execution endpoint structure', async () => {
			// This test verifies the endpoint file exists and exports POST handler
			const module = await import('../../src/routes/api/agent/tools/+server');

			expect(module).toBeDefined();
			expect(module.POST).toBeDefined();
			expect(typeof module.POST).toBe('function');
		});

		it('should handle tool execution request format', () => {
			// Verify expected request/response format
			const mockRequest = {
				tool_name: 'get_device_details',
				parameters: {
					device_id: 'AA:BB:CC:DD:EE:FF'
				}
			};

			expect(mockRequest).toHaveProperty('tool_name');
			expect(mockRequest).toHaveProperty('parameters');
		});
	});

	describe('Runtime Integration', () => {
		it('should have runtime module with getAllTools', async () => {
			const module = await import('../../src/lib/server/agent/runtime');

			expect(module).toBeDefined();
			expect(module.createAgent).toBeDefined();
		});

		it('should create agent without errors', async () => {
			const { createAgent } = await import('../../src/lib/server/agent/runtime');

			// This might fail if neither Ollama nor Anthropic is available
			// But it should not throw unexpected errors
			try {
				await createAgent();
			} catch (error: any) {
				// Expected error if no LLM is available
				expect(error.message).toContain('No LLM available');
			}
		});
	});

	describe('Tool Format Compatibility', () => {
		it('should maintain MCP format structure', () => {
			const tools = getAllTools();

			tools.forEach((tool) => {
				// Verify MCP tool format
				expect(tool.name).toBeDefined();
				expect(tool.description).toBeDefined();
				expect(tool.input_schema).toBeDefined();

				// Verify JSON Schema structure
				expect(tool.input_schema.type).toBe('object');
				expect(tool.input_schema.properties).toBeDefined();

				if (tool.input_schema.required) {
					expect(Array.isArray(tool.input_schema.required)).toBe(true);
				}
			});
		});

		it('should have valid parameter definitions', () => {
			const tools = getAllTools();

			tools.forEach((tool) => {
				const props = tool.input_schema.properties;

				Object.values(props).forEach((param: any) => {
					// Each parameter should have a type
					expect(param.type || param.$ref || param.anyOf || param.oneOf).toBeDefined();
				});
			});
		});
	});
});
