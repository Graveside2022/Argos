/**
 * MCP Tools for Argos Agent
 * Provides agent with ability to query devices, signals, and tactical data
 */

import { getFrontendToolsForAgent } from '$lib/server/agent/frontend-tools';
import { argosTools, type Tool } from '$lib/server/agent/tool-schemas';

export { argosTools };

/**
 * Get all available tools (hardcoded + frontend)
 */
export function getAllTools(): Tool[] {
	const frontendTools = getFrontendToolsForAgent();
	return [...argosTools, ...frontendTools];
}

/**
 * Get tool list formatted for system prompt
 */
function getToolListForPrompt(): string {
	const tools = getAllTools();

	if (tools.length === 0) {
		return '- No tools currently available';
	}

	return tools
		.map((tool, index) => {
			const params = Object.keys(tool.input_schema?.properties || {}).join(', ');
			return `${index + 1}. ${tool.name}${params ? ` (${params})` : ''} - ${tool.description}`;
		})
		.join('\n');
}

interface SystemContext {
	selectedDevice?: string;
	selectedDeviceDetails?: {
		ssid: string;
		type: string;
		manufacturer: string;
		signalDbm: number | null;
		channel: string;
		frequency: number;
		encryption: string;
		packets: number;
	};
	userLocation?: { lat: number; lon: number };
	activeSignals?: number;
	kismetStatus?: { connected: boolean; status: string };
	currentWorkflow?: string;
	workflowStep?: number;
	workflowGoal?: string;
}

/**
 * System prompt for Argos Agent
 * Provides context about the system and available capabilities
 */
export function getSystemPrompt(context?: SystemContext): string {
	const timestamp = new Date().toISOString();

	// Extract context from AG-UI shared state structure
	const selectedDevice = context?.selectedDevice;
	const selectedDeviceDetails = context?.selectedDeviceDetails;
	const userLocation = context?.userLocation;
	const activeSignals = context?.activeSignals;
	const kismetStatus = context?.kismetStatus;
	const currentWorkflow = context?.currentWorkflow;
	const workflowStep = context?.workflowStep;
	const workflowGoal = context?.workflowGoal;

	// Build device context string if device is selected
	let deviceContext = '';
	if (selectedDevice && selectedDeviceDetails) {
		deviceContext = `
- SELECTED TARGET: ${selectedDevice}
  SSID: ${selectedDeviceDetails.ssid}
  Type: ${selectedDeviceDetails.type}
  Manufacturer: ${selectedDeviceDetails.manufacturer}
  Signal: ${selectedDeviceDetails.signalDbm !== null ? `${selectedDeviceDetails.signalDbm} dBm` : 'Unknown'}
  Channel: ${selectedDeviceDetails.channel || 'Unknown'}
  Frequency: ${selectedDeviceDetails.frequency ? `${selectedDeviceDetails.frequency} MHz` : 'Unknown'}
  Encryption: ${selectedDeviceDetails.encryption || 'Unknown'}
  Packets: ${selectedDeviceDetails.packets}
  [OPERATOR CLICKED THIS DEVICE - PROVIDE DETAILED TACTICAL ANALYSIS]`;
	}

	// Build workflow context if active
	let workflowContext = '';
	if (currentWorkflow) {
		workflowContext = `
ACTIVE WORKFLOW: ${currentWorkflow}
- Goal: ${workflowGoal || 'Not specified'}
- Step: ${(workflowStep ?? 0) + 1}
- Continue guiding the operator through this workflow`;
	}

	return `You are Argos Agent, a tactical SIGINT assistant for the Argos SDR & Network Analysis Console.
Time: ${timestamp}

CONTEXT:
${deviceContext || '- No device selected'}
${activeSignals ? `- ${activeSignals} active signals` : '- Signals: standby'}
${userLocation ? `- Position: ${userLocation.lat.toFixed(4)}°N, ${userLocation.lon.toFixed(4)}°E` : ''}
${kismetStatus?.connected ? `- Kismet: ${kismetStatus.status}` : '- Kismet: disconnected'}
${workflowContext}

TOOLS: ${getToolListForPrompt()}

To use a tool, state which tool and parameters. Example: "get_device_details device_id: AA:BB:CC:DD:EE:FF"

RULES: Be direct and tactical. Use SIGINT terminology. Flag security threats (evil twins, rogue APs, IMSI-catchers, weak encryption). Provide actionable intelligence.`;
}
