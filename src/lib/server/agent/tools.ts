/**
 * MCP Tools for Argos Agent
 * Provides agent with ability to query devices, signals, and tactical data
 */

import { getFrontendToolsForAgent } from '$lib/server/agent/frontend-tools';

export const argosTools = [
	{
		name: 'get_device_details',
		description:
			'Get detailed information about a WiFi device or network. Use this when the operator asks about a specific device (like "ARRIS-0DC8") or when they click on a device in the UI.',
		input_schema: {
			type: 'object',
			properties: {
				device_id: {
					type: 'string',
					description:
						'The device ID or MAC address (e.g., "ARRIS-0DC8", "00:11:22:33:44:55")'
				}
			},
			required: ['device_id']
		}
	},
	{
		name: 'get_nearby_signals',
		description:
			'Get RF signals detected near a specific location. Returns signal strength, frequency, and type information.',
		input_schema: {
			type: 'object',
			properties: {
				latitude: {
					type: 'number',
					description: 'Latitude coordinate'
				},
				longitude: {
					type: 'number',
					description: 'Longitude coordinate'
				},
				radius_meters: {
					type: 'number',
					description: 'Search radius in meters (default: 100)',
					default: 100
				},
				min_power: {
					type: 'number',
					description: 'Minimum signal power in dBm (optional)',
					default: -100
				}
			},
			required: ['latitude', 'longitude']
		}
	},
	{
		name: 'analyze_network_security',
		description:
			'Analyze the security configuration of a WiFi network. Identifies encryption type, vulnerabilities, and security recommendations.',
		input_schema: {
			type: 'object',
			properties: {
				network_id: {
					type: 'string',
					description: 'The network SSID or BSSID'
				}
			},
			required: ['network_id']
		}
	},
	{
		name: 'get_active_devices',
		description:
			'Get all currently active WiFi devices within detection range. Returns a list of devices with their signal strength and last seen time.',
		input_schema: {
			type: 'object',
			properties: {
				filter_type: {
					type: 'string',
					description: 'Filter by device type: "wifi", "bluetooth", "cellular", or "all"',
					enum: ['wifi', 'bluetooth', 'cellular', 'all'],
					default: 'all'
				},
				min_signal_strength: {
					type: 'number',
					description: 'Minimum signal strength in dBm',
					default: -90
				},
				time_window_seconds: {
					type: 'number',
					description: 'Only show devices seen within this many seconds',
					default: 300
				}
			}
		}
	},
	{
		name: 'get_spectrum_data',
		description:
			'Get current RF spectrum data from HackRF. Returns frequency spectrum analysis for a given frequency range.',
		input_schema: {
			type: 'object',
			properties: {
				start_freq_mhz: {
					type: 'number',
					description: 'Start frequency in MHz'
				},
				end_freq_mhz: {
					type: 'number',
					description: 'End frequency in MHz'
				}
			},
			required: ['start_freq_mhz', 'end_freq_mhz']
		}
	},
	{
		name: 'get_cell_towers',
		description:
			'Get nearby cell towers and their information. Useful for analyzing cellular network coverage and identifying fake base stations.',
		input_schema: {
			type: 'object',
			properties: {
				latitude: {
					type: 'number',
					description:
						'Latitude coordinate (optional - uses current position if not provided)'
				},
				longitude: {
					type: 'number',
					description:
						'Longitude coordinate (optional - uses current position if not provided)'
				},
				radius_km: {
					type: 'number',
					description: 'Search radius in kilometers',
					default: 5
				}
			}
		}
	},
	{
		name: 'query_signal_history',
		description:
			'Query historical signal data from the SQLite database. Useful for tracking signal patterns over time.',
		input_schema: {
			type: 'object',
			properties: {
				device_id: {
					type: 'string',
					description: 'Device ID to query (optional)'
				},
				start_time: {
					type: 'string',
					description: 'Start time in ISO format (optional)'
				},
				end_time: {
					type: 'string',
					description: 'End time in ISO format (optional)'
				},
				min_frequency: {
					type: 'number',
					description: 'Minimum frequency in Hz (optional)'
				},
				max_frequency: {
					type: 'number',
					description: 'Maximum frequency in Hz (optional)'
				},
				limit: {
					type: 'number',
					description: 'Maximum number of results',
					default: 100
				}
			}
		}
	},
	{
		name: 'get_map_state',
		description:
			'Get current tactical map state including visible area, selected layers, and active markers.',
		input_schema: {
			type: 'object',
			properties: {}
		}
	}
];

/**
 * Get all available tools (hardcoded + frontend)
 */
export function getAllTools(): Array<{ name: string; description: string; input_schema: any }> {
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

/**
 * System prompt for Argos Agent
 * Provides context about the system and available capabilities
 */
export function getSystemPrompt(context?: any): string {
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
- Step: ${workflowStep + 1}
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
