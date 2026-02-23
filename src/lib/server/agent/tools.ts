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

/** Format a device metric with fallback */
function deviceField(value: string | number | null | undefined, suffix?: string): string {
	if (value === null || value === undefined || value === '') return 'Unknown';
	return suffix ? `${value} ${suffix}` : String(value);
}

/** Format selected device details into prompt lines */
function formatDeviceDetails(dev: NonNullable<SystemContext['selectedDeviceDetails']>): string {
	return `  SSID: ${dev.ssid}
  Type: ${dev.type}
  Manufacturer: ${dev.manufacturer}
  Signal: ${deviceField(dev.signalDbm, 'dBm')}
  Channel: ${deviceField(dev.channel)}
  Frequency: ${deviceField(dev.frequency, 'MHz')}
  Encryption: ${deviceField(dev.encryption)}
  Packets: ${dev.packets}`;
}

/** Build the device context section for the system prompt */
function buildDeviceContext(context?: SystemContext): string {
	const dev = context?.selectedDeviceDetails;
	if (!context?.selectedDevice || !dev) return '- No device selected';
	return `\n- SELECTED TARGET: ${context.selectedDevice}
${formatDeviceDetails(dev)}
  [OPERATOR CLICKED THIS DEVICE - PROVIDE DETAILED TACTICAL ANALYSIS]`;
}

/** Build the workflow context section for the system prompt */
function buildWorkflowContext(context?: SystemContext): string {
	if (!context?.currentWorkflow) return '';
	return `\nACTIVE WORKFLOW: ${context.currentWorkflow}
- Goal: ${context.workflowGoal || 'Not specified'}
- Step: ${(context.workflowStep ?? 0) + 1}
- Continue guiding the operator through this workflow`;
}

/** Format signal count line */
function signalLine(activeSignals?: number): string {
	return activeSignals ? `- ${activeSignals} active signals` : '- Signals: standby';
}

/** Format GPS position line, or empty string if unavailable */
function positionLine(loc?: { lat: number; lon: number }): string {
	if (!loc) return '';
	return `- Position: ${loc.lat.toFixed(4)}°N, ${loc.lon.toFixed(4)}°E`;
}

/** Format Kismet status line */
function kismetLine(status?: { connected: boolean; status: string }): string {
	return status?.connected ? `- Kismet: ${status.status}` : '- Kismet: disconnected';
}

/** Build status lines (signals, position, Kismet) */
function buildStatusLines(context?: SystemContext): string {
	const lines = [signalLine(context?.activeSignals)];
	const pos = positionLine(context?.userLocation);
	if (pos) lines.push(pos);
	lines.push(kismetLine(context?.kismetStatus));
	return lines.join('\n');
}

/**
 * System prompt for Argos Agent
 * Provides context about the system and available capabilities
 */
export function getSystemPrompt(context?: SystemContext): string {
	return `You are Argos Agent, a tactical SIGINT assistant for the Argos SDR & Network Analysis Console.
Time: ${new Date().toISOString()}

CONTEXT:
${buildDeviceContext(context)}
${buildStatusLines(context)}
${buildWorkflowContext(context)}

TOOLS: ${getToolListForPrompt()}

To use a tool, state which tool and parameters. Example: "get_device_details device_id: AA:BB:CC:DD:EE:FF"

RULES: Be direct and tactical. Use SIGINT terminology. Flag security threats (evil twins, rogue APs, IMSI-catchers, weak encryption). Provide actionable intelligence.`;
}
