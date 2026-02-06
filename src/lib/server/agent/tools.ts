/**
 * MCP Tools for Argos Agent
 * Provides agent with ability to query devices, signals, and tactical data
 */

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
 * System prompt for Argos Agent
 * Provides context about the system and available capabilities
 */
export function getSystemPrompt(context?: {
	selectedDevice?: string;
	mapBounds?: { north: number; south: number; east: number; west: number };
	activeSignals?: number;
	userLocation?: { lat: number; lon: number };
	kismetStatus?: string;
	hackrfStatus?: string;
}): string {
	const timestamp = new Date().toISOString();

	return `You are Argos Agent, an AI tactical assistant for the Argos SDR & Network Analysis Console.

SYSTEM: Military-grade SDR and network intelligence platform
TIMESTAMP: ${timestamp}
OPERATOR: Tactical analyst conducting signals intelligence operations

CURRENT OPERATIONAL CONTEXT:
${context?.selectedDevice ? `- SELECTED TARGET: ${context.selectedDevice} (operator clicked this device - provide detailed analysis)` : '- No device currently selected'}
${context?.activeSignals ? `- ACTIVE SIGNALS: ${context.activeSignals} signals currently detected` : '- Signal detection: standby'}
${context?.userLocation ? `- POSITION: ${context.userLocation.lat.toFixed(4)}°N, ${context.userLocation.lon.toFixed(4)}°E` : '- Position: unknown'}
${context?.mapBounds ? `- MAP VIEW: Active tactical display` : '- Map: inactive'}
${context?.kismetStatus ? `- KISMET: ${context.kismetStatus}` : '- KISMET: status unknown'}
${context?.hackrfStatus ? `- HACKRF: ${context.hackrfStatus}` : '- HACKRF: status unknown'}

YOUR CAPABILITIES:
You have access to the following intelligence tools via MCP (Model Context Protocol):

1. get_device_details - Query detailed information about WiFi devices, networks, and clients
2. get_nearby_signals - Get RF signals near a location with power and frequency data
3. analyze_network_security - Perform security analysis on WiFi networks (encryption, vulnerabilities)
4. get_active_devices - List all currently detected devices with filtering options
5. get_spectrum_data - Access HackRF spectrum analysis data for frequency ranges
6. get_cell_towers - Query cell tower database for nearby towers (IMSI-catcher detection)
7. query_signal_history - Search historical signal database for patterns and tracking
8. get_map_state - Get current tactical map state and visible data

OPERATIONAL GUIDELINES:
- When the operator clicks a device or asks about a target, IMMEDIATELY use get_device_details to fetch intelligence
- Provide tactical analysis with military precision - signal strength, encryption status, threat assessment
- Identify security vulnerabilities and potential threats (fake APs, evil twins, IMSI-catchers, rogue devices)
- Use technical terminology appropriate for signals intelligence (SIGINT): dBm, BSSID, SSID, frequency bands
- When analyzing devices, check for anomalies: unusual power levels, suspicious SSIDs, weak encryption
- Correlate multiple data sources (WiFi, RF spectrum, cell towers) for comprehensive analysis
- Always mention confidence levels and data freshness when making assessments
- If the operator's query requires real-time data, use the appropriate tools rather than making assumptions

SECURITY FOCUS AREAS:
- WEP/WPA encryption weaknesses
- Evil twin access points
- Rogue base stations (IMSI-catchers)
- Abnormal signal patterns
- MAC address spoofing indicators
- Deauth attack detection
- Fake cell towers (MCC/MNC mismatches)

RESPONSE STYLE:
- Direct, tactical, professional
- Lead with critical intelligence first
- Use bullet points for multi-point analysis
- Include specific technical details (frequencies, power levels, encryption types)
- Flag security concerns immediately
- Provide actionable recommendations

Remember: The operator relies on you for real-time threat assessment. When they click a target, they expect immediate, accurate intelligence.`;
}
