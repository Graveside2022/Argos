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
	},
	{
		name: 'create_mission',
		description:
			'Create a new Argos mission (sitrep-loop or emcon-survey). Use when the operator starts a new training event, engagement, or EMCON survey. Optionally marks the new mission as the active mission.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Mission name (e.g., "NTC Rot 24-08")' },
				type: {
					type: 'string',
					enum: ['sitrep-loop', 'emcon-survey'],
					description: 'Mission type'
				},
				unit: { type: 'string', description: 'Owning unit (optional)' },
				ao_mgrs: { type: 'string', description: 'AO center as MGRS (optional)' },
				set_active: {
					type: 'boolean',
					description: 'Promote the new mission to active (default false)'
				}
			},
			required: ['name', 'type']
		}
	},
	{
		name: 'set_active_mission',
		description:
			'Promote an existing mission to active. Subsequent captures and reports default to this mission when no mission_id is provided.',
		input_schema: {
			type: 'object',
			properties: {
				mission_id: { type: 'string', description: 'Mission ID to activate' }
			},
			required: ['mission_id']
		}
	},
	{
		name: 'start_capture',
		description:
			'Start a new capture against a mission. Role determines semantics: baseline (pre-EMCON ground truth), posture (post-EMCON snapshot), or tick (periodic SITREP snapshot). Uses the active mission if mission_id is omitted.',
		input_schema: {
			type: 'object',
			properties: {
				role: {
					type: 'string',
					enum: ['baseline', 'posture', 'tick'],
					description: 'Capture role'
				},
				mission_id: {
					type: 'string',
					description: 'Mission ID (optional — defaults to active mission)'
				},
				loadout: {
					type: 'object',
					description:
						'Sensor loadout manifest: { sensors: [{ tool, interface?, gain?, channels? }] }'
				}
			},
			required: ['role', 'loadout']
		}
	},
	{
		name: 'stop_capture',
		description:
			'Close an open capture. Used to finalize baseline, posture, or tick captures so they can be used by report generators.',
		input_schema: {
			type: 'object',
			properties: {
				capture_id: { type: 'string', description: 'Capture ID to stop' }
			},
			required: ['capture_id']
		}
	},
	{
		name: 'generate_sitrep',
		description:
			'Generate a SITREP Quarto report for the given mission and time window. Pulls the latest tick-role capture in the window and renders HTML + PDF + reveal.js slides. Defaults to the active mission and a 15-minute window ending now.',
		input_schema: {
			type: 'object',
			properties: {
				mission_id: { type: 'string', description: 'Mission ID (optional)' },
				period_start: {
					type: 'number',
					description: 'Window start (epoch ms, optional)'
				},
				period_end: {
					type: 'number',
					description: 'Window end (epoch ms, optional)'
				},
				narrative: {
					type: 'string',
					description: 'Operator narrative to embed in the report (optional)'
				}
			}
		}
	},
	{
		name: 'generate_emcon_survey',
		description:
			'Generate an EMCON Survey Quarto report. Requires that the mission has both a baseline and a posture capture. Runs the EMCON diff engine and produces HTML + PDF + reveal.js slides.',
		input_schema: {
			type: 'object',
			properties: {
				mission_id: { type: 'string', description: 'Mission ID (optional)' },
				narrative: {
					type: 'string',
					description: 'Operator narrative to embed in the report (optional)'
				}
			}
		}
	},
	{
		name: 'generate_diagram',
		description:
			'Generate a technical diagram (architecture, data flow, sequence, etc.) and attach it to a report. V1 stub: returns a placeholder — the fireworks-tech-graph skill must currently be invoked manually by the agent.',
		input_schema: {
			type: 'object',
			properties: {
				prompt: { type: 'string', description: 'Natural-language diagram description' },
				style: { type: 'string', description: 'Optional style hint' },
				report_id: {
					type: 'string',
					description: 'Report ID this diagram should be attached to'
				}
			},
			required: ['prompt', 'report_id']
		}
	}
];
