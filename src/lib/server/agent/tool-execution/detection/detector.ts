/**
 * Main Tool Detector
 *
 * Orchestrates detection across Docker, native binaries, and SystemD services
 * Integrates with toolHierarchy to determine installation status
 */

import { findDockerContainer } from './docker-detector';
import { checkBinary } from './binary-detector';
import { checkService } from './service-detector';
import { mapDetectedTools, type DetectedTool } from './tool-mapper';
import { toolHierarchy } from '$lib/data/tool-hierarchy';
import type { ToolDefinition as UIToolDef } from '$lib/types/tools';
import type { ToolDefinition as ExecToolDef } from '../types';
import { globalRegistry } from '../registry';

/**
 * Scan system for all installed tools from the tool hierarchy
 */
export async function scanInstalledTools(): Promise<{
	detected: DetectedTool[];
	registered: ExecToolDef[];
	stats: {
		total: number;
		installed: number;
		docker: number;
		native: number;
		service: number;
	};
}> {
	console.log('[ToolDetector] Starting system scan for installed tools...');

	// Get all tools from hierarchy
	const allTools = flattenToolHierarchy(toolHierarchy.root);
	console.log(`[ToolDetector] Found ${allTools.length} tools in hierarchy`);

	// Detect installations
	const detected: DetectedTool[] = [];

	for (const tool of allTools) {
		const detection = await detectTool(tool);
		detected.push(detection);
	}

	// Count statistics
	const installed = detected.filter((d) => d.installed);
	const dockerTools = installed.filter((d) => d.deployment === 'docker');
	const nativeTools = installed.filter((d) => d.deployment === 'native');
	const serviceTools = installed.filter((d) => d.deployment === 'service');

	console.log(`[ToolDetector] Scan complete:`);
	console.log(`  - Total tools: ${allTools.length}`);
	console.log(`  - Installed: ${installed.length}`);
	console.log(`    - Docker: ${dockerTools.length}`);
	console.log(`    - Native: ${nativeTools.length}`);
	console.log(`    - Service: ${serviceTools.length}`);

	// Map detected tools to execution tool definitions
	const execTools = mapDetectedTools(allTools, detected);

	// Auto-register with execution framework
	if (execTools.length > 0) {
		console.log(`[ToolDetector] Auto-registering ${execTools.length} tools...`);
		globalRegistry.registerBulk(execTools);
	}

	return {
		detected,
		registered: execTools,
		stats: {
			total: allTools.length,
			installed: installed.length,
			docker: dockerTools.length,
			native: nativeTools.length,
			service: serviceTools.length
		}
	};
}

/**
 * Detect a single tool's installation status
 */
export async function detectTool(tool: UIToolDef): Promise<DetectedTool> {
	const result: DetectedTool = {
		toolId: tool.id,
		toolName: tool.name,
		installed: false,
		deployment: tool.deployment as 'docker' | 'native' | 'service'
	};

	// If tool is marked as installed in hierarchy, it might be a built-in Argos feature
	// We still check to confirm
	if (tool.installed && tool.deployment === 'native' && tool.viewName) {
		// This is a built-in Argos feature (like hackrf-spectrum, kismet-wifi)
		// These are already integrated, so we consider them installed
		result.installed = true;
		return result;
	}

	// Detect based on deployment type
	if (tool.deployment === 'docker') {
		// Check for Docker container
		const containerName = generateContainerName(tool.id);
		const container = await findDockerContainer(containerName);

		if (container) {
			result.installed = true;
			result.container = container;
		}
	} else if (tool.deployment === 'native') {
		// Check for native binary
		const binaryName = extractBinaryName(tool.id);
		const binary = await checkBinary(binaryName);

		if (binary) {
			result.installed = true;
			result.binary = binary;
		}
	} else if (tool.deployment === 'service') {
		// Check for SystemD service
		const serviceName = generateServiceName(tool.id);
		const service = await checkService(serviceName);

		if (service) {
			result.installed = true;
			result.service = service;
		}
	}

	return result;
}

/**
 * Quick check if a specific tool is installed
 */
export async function isToolInstalled(toolId: string): Promise<boolean> {
	// Find tool in hierarchy
	const allTools = flattenToolHierarchy(toolHierarchy.root);
	const tool = allTools.find((t) => t.id === toolId);

	if (!tool) return false;

	const detection = await detectTool(tool);
	return detection.installed;
}

/**
 * Flatten tool hierarchy to array of all tools
 */
function flattenToolHierarchy(category: any): UIToolDef[] {
	const tools: UIToolDef[] = [];

	if (!category.children) return tools;

	for (const child of category.children) {
		if ('children' in child) {
			// Category - recurse
			tools.push(...flattenToolHierarchy(child));
		} else {
			// Tool - add to list
			tools.push(child as UIToolDef);
		}
	}

	return tools;
}

/**
 * Generate Docker container name from tool ID
 * Examples: 'bluing' -> 'argos-bluing'
 */
function generateContainerName(toolId: string): string {
	return `argos-${toolId}`;
}

/**
 * Generate service name from tool ID
 * Examples: 'kismet-wifi' -> 'kismet'
 */
function generateServiceName(toolId: string): string {
	return toolId.replace(/-wifi$/, '').replace(/-spectrum$/, '');
}

/**
 * Extract binary name from tool ID
 */
function extractBinaryName(toolId: string): string {
	// Map tool IDs to actual binary names
	const binaryMap: Record<string, string> = {
		'hackrf-spectrum': 'hackrf_sweep',
		'kismet-wifi': 'kismet',
		'gsm-evil': 'gsm-scanner',
		'gr-gsm': 'grgsm',
		wifite: 'wifite',
		'rtl-433': 'rtl_433',
		'drone-id': 'droneid',
		bluing: 'bluing',
		bluesnarfer: 'bluesnarfer',
		bluetoolkit: 'bluetoolkit',
		bettercap: 'bettercap',
		ettercap: 'ettercap',
		responder: 'responder',
		satori: 'satori',
		p0f: 'p0f',
		ndpi: 'ndpi',
		cryptolyzer: 'cryptolyzer'
	};

	return binaryMap[toolId] || toolId.replace(/-/g, '');
}
