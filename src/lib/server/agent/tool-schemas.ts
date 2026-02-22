/**
 * Hardcoded MCP tool schemas for Argos Agent.
 * Defines input schemas for device, signal, spectrum, and map queries.
 */

interface ToolSchema {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
}

export interface Tool {
	name: string;
	description: string;
	input_schema: ToolSchema;
}

export const argosTools: Tool[] = [
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
