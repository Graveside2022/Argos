/**
 * Tool Mapper
 *
 * Maps tool definitions from toolHierarchy to backend configurations
 * and generates execution parameters based on detected installation method
 */

import type { ToolDefinition as ExecToolDef, CLIBackendConfig } from '../types';
import type { ToolDefinition as UIToolDef } from '$lib/types/tools';
import type { DockerContainer } from './docker-detector';
import type { BinaryInfo } from './binary-detector';
import type { ServiceInfo } from './service-detector';

/**
 * Tool detection result
 */
export interface DetectedTool {
	toolId: string;
	toolName: string;
	installed: boolean;
	deployment: 'docker' | 'native' | 'service';
	container?: DockerContainer;
	binary?: BinaryInfo;
	service?: ServiceInfo;
}

/**
 * Map UI tool definition to execution tool definition
 */
export function mapToExecutionTool(uiTool: UIToolDef, detection: DetectedTool): ExecToolDef | null {
	if (!detection.installed) return null;

	// Generate namespace from tool hierarchy path
	const namespace = generateNamespace(uiTool.id);

	// Generate backend configuration based on deployment type
	let backendConfig: CLIBackendConfig;

	if (detection.deployment === 'docker' && detection.container) {
		// Docker execution via 'docker exec'
		backendConfig = {
			type: 'cli',
			command: 'docker',
			args: [
				'exec',
				'-i',
				detection.container.name,
				extractBinaryName(uiTool.id),
				'{{args}}'
			],
			timeout: 30000
		};
	} else if (detection.deployment === 'native' && detection.binary) {
		// Native binary execution
		backendConfig = {
			type: 'cli',
			command: detection.binary.path,
			args: ['{{args}}'],
			timeout: 30000
		};
	} else if (detection.deployment === 'service' && detection.service) {
		// Service-based tool (usually has HTTP API)
		// For now, we'll use CLI to interact with systemctl
		backendConfig = {
			type: 'cli',
			command: 'systemctl',
			args: ['status', detection.service.name],
			timeout: 5000
		};
	} else {
		return null;
	}

	// Create execution tool definition
	const execTool: ExecToolDef = {
		name: uiTool.id,
		namespace,
		description: uiTool.description || uiTool.name,
		backendType: 'cli',
		backendConfig,
		parameters: {
			args: {
				type: 'string',
				description: 'Command arguments'
			}
		},
		requiredParameters: [],
		tags: [detection.deployment]
	};

	return execTool;
}

/**
 * Generate namespace from tool ID
 * Examples:
 *   'bluing' -> 'bluetooth.recon'
 *   'hackrf-spectrum' -> 'spectrum.analysis'
 *   'kismet-wifi' -> 'wifi.recon'
 */
function generateNamespace(toolId: string): string {
	// Map common tool patterns to namespaces
	const namespaceMap: Record<string, string> = {
		// Bluetooth
		bluing: 'bluetooth.recon',
		bluesnarfer: 'bluetooth.attack',
		bluetoolkit: 'bluetooth.attack',
		'mirage-framework': 'bluetooth.attack',

		// WiFi
		kismet: 'wifi.recon',
		wifite: 'wifi.attack',
		bettercap: 'network.attack',
		airgeddon: 'wifi.attack',
		wifiphisher: 'wifi.attack',

		// Spectrum
		'hackrf-spectrum': 'spectrum.analysis',
		'rf-sweep': 'spectrum.analysis',
		openwebrx: 'spectrum.analysis',

		// Cellular
		'gsm-evil': 'cellular.recon',
		'gr-gsm': 'cellular.recon',

		// Network
		ettercap: 'network.attack',
		responder: 'network.attack',
		p0f: 'network.recon',
		satori: 'network.recon',

		// Drone
		'drone-id': 'drone.recon',
		dronesploit: 'drone.attack',

		// IoT
		'rtl-433': 'iot.recon',
		zigator: 'iot.recon'
	};

	// Check if we have a specific mapping
	if (namespaceMap[toolId]) {
		return namespaceMap[toolId];
	}

	// Fallback: infer from tool ID
	if (toolId.includes('wifi') || toolId.includes('802')) {
		return 'wifi.recon';
	} else if (toolId.includes('bluetooth') || toolId.includes('ble') || toolId.includes('bt')) {
		return 'bluetooth.recon';
	} else if (toolId.includes('gsm') || toolId.includes('lte') || toolId.includes('cellular')) {
		return 'cellular.recon';
	} else if (toolId.includes('drone') || toolId.includes('uas')) {
		return 'drone.recon';
	} else if (toolId.includes('iot') || toolId.includes('lora') || toolId.includes('zigbee')) {
		return 'iot.recon';
	} else if (toolId.includes('spectrum') || toolId.includes('sdr')) {
		return 'spectrum.analysis';
	} else if (toolId.includes('network') || toolId.includes('net')) {
		return 'network.recon';
	}

	// Default namespace
	return 'tools.unknown';
}

/**
 * Extract binary name from tool ID
 * Examples:
 *   'bluing' -> 'bluing'
 *   'hackrf-spectrum' -> 'hackrf_sweep'
 *   'kismet-wifi' -> 'kismet'
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
		'drone-id': 'droneid'
	};

	if (binaryMap[toolId]) {
		return binaryMap[toolId];
	}

	// Remove common suffixes and convert to binary name
	return toolId
		.replace(/-wifi$/, '')
		.replace(/-spectrum$/, '')
		.replace(/-scanner$/, '');
}

/**
 * Batch map multiple detected tools
 */
export function mapDetectedTools(uiTools: UIToolDef[], detections: DetectedTool[]): ExecToolDef[] {
	const execTools: ExecToolDef[] = [];

	for (const detection of detections) {
		if (!detection.installed) continue;

		const uiTool = uiTools.find((t) => t.id === detection.toolId);
		if (!uiTool) continue;

		const execTool = mapToExecutionTool(uiTool, detection);
		if (execTool) {
			execTools.push(execTool);
		}
	}

	console.log(`[ToolMapper] Mapped ${execTools.length}/${detections.length} detected tools`);
	return execTools;
}
