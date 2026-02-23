/**
 * Frontend Tools for Agent UI Control
 *
 * These tools allow the agent to interact with and manipulate the Argos UI,
 * providing a generative UI experience where the agent can:
 * - Highlight devices on the map
 * - Zoom to locations
 * - Show alerts/notifications
 * - Control workflow state
 * - Trigger UI actions
 */

export interface FrontendTool {
	name: string;
	description: string;
	parameters: Record<
		string,
		{
			type: string;
			description: string;
			required?: boolean;
			enum?: string[];
		}
	>;
	handler: 'client'; // Indicates this tool runs on client-side
}

/**
 * Frontend tools registry
 * These are sent to the agent but executed on the client (browser)
 */
export const frontendTools: FrontendTool[] = [
	{
		name: 'highlightDevice',
		description:
			'Highlight a specific device on the tactical map. Use when you want to draw attention to a device.',
		parameters: {
			mac: {
				type: 'string',
				description: 'MAC address of the device to highlight',
				required: true
			},
			duration: {
				type: 'number',
				description: 'How long to highlight in milliseconds (default: 3000)'
			},
			color: {
				type: 'string',
				description: 'Highlight color',
				enum: ['red', 'yellow', 'blue', 'green']
			}
		},
		handler: 'client'
	},
	{
		name: 'zoomToLocation',
		description:
			'Zoom the tactical map to a specific GPS location. Use to focus on a geographic area.',
		parameters: {
			lat: {
				type: 'number',
				description: 'Latitude',
				required: true
			},
			lon: {
				type: 'number',
				description: 'Longitude',
				required: true
			},
			zoom: {
				type: 'number',
				description: 'Zoom level (1-20, default: 16)'
			}
		},
		handler: 'client'
	},
	{
		name: 'zoomToDevice',
		description:
			'Zoom the map to show a specific device. Use when investigating a particular device.',
		parameters: {
			mac: {
				type: 'string',
				description: 'MAC address of the device',
				required: true
			},
			zoom: {
				type: 'number',
				description: 'Zoom level (default: 17)'
			}
		},
		handler: 'client'
	},
	{
		name: 'showAlert',
		description:
			'Display an alert message to the operator. Use for important notifications or warnings.',
		parameters: {
			message: {
				type: 'string',
				description: 'Alert message to display',
				required: true
			},
			type: {
				type: 'string',
				description: 'Alert severity level',
				enum: ['info', 'warning', 'error', 'success']
			},
			duration: {
				type: 'number',
				description: 'How long to show alert in milliseconds (default: 5000)'
			}
		},
		handler: 'client'
	},
	{
		name: 'setWorkflow',
		description:
			'Set the current workflow context. Use to guide the operator through structured tasks.',
		parameters: {
			workflow: {
				type: 'string',
				description: 'Workflow type',
				enum: [
					'reconnaissance',
					'device_investigation',
					'threat_analysis',
					'network_mapping',
					'rogue_ap_detection',
					'imsi_catcher_detection'
				],
				required: true
			},
			goal: {
				type: 'string',
				description: 'Workflow objective description'
			}
		},
		handler: 'client'
	},
	{
		name: 'nextWorkflowStep',
		description: 'Advance to the next step in the current workflow.',
		parameters: {},
		handler: 'client'
	},
	{
		name: 'clearWorkflow',
		description: 'Clear/exit the current workflow.',
		parameters: {},
		handler: 'client'
	},
	{
		name: 'filterDevices',
		description:
			'Filter the device list by criteria. Use to help operator focus on relevant devices.',
		parameters: {
			type: {
				type: 'string',
				description: 'Device type filter',
				enum: ['wifi', 'bluetooth', 'cellular', 'all']
			},
			signalStrength: {
				type: 'string',
				description: 'Signal strength filter',
				enum: ['strong', 'medium', 'weak', 'all']
			},
			encryption: {
				type: 'string',
				description: 'Encryption filter',
				enum: ['encrypted', 'open', 'all']
			}
		},
		handler: 'client'
	},
	{
		name: 'showDeviceDetails',
		description: 'Open the device details panel for a specific device.',
		parameters: {
			mac: {
				type: 'string',
				description: 'MAC address of the device',
				required: true
			}
		},
		handler: 'client'
	},
	{
		name: 'createMarker',
		description: 'Create a custom marker on the map for annotation or waypoint.',
		parameters: {
			lat: {
				type: 'number',
				description: 'Latitude',
				required: true
			},
			lon: {
				type: 'number',
				description: 'Longitude',
				required: true
			},
			label: {
				type: 'string',
				description: 'Marker label',
				required: true
			},
			type: {
				type: 'string',
				description: 'Marker type',
				enum: ['waypoint', 'threat', 'interest', 'reference']
			}
		},
		handler: 'client'
	},
	{
		name: 'drawCircle',
		description: 'Draw a circle on the map to mark a radius or area of interest.',
		parameters: {
			lat: {
				type: 'number',
				description: 'Center latitude',
				required: true
			},
			lon: {
				type: 'number',
				description: 'Center longitude',
				required: true
			},
			radius: {
				type: 'number',
				description: 'Radius in meters',
				required: true
			},
			label: {
				type: 'string',
				description: 'Label for the circle'
			}
		},
		handler: 'client'
	},
	{
		name: 'startMonitoring',
		description: 'Start monitoring a specific device or frequency.',
		parameters: {
			target: {
				type: 'string',
				description: 'MAC address or frequency to monitor',
				required: true
			},
			type: {
				type: 'string',
				description: 'Monitoring type',
				enum: ['device', 'frequency', 'channel']
			},
			duration: {
				type: 'number',
				description: 'Monitoring duration in seconds'
			}
		},
		handler: 'client'
	},
	{
		name: 'compareDevices',
		description: 'Open side-by-side comparison view for multiple devices.',
		parameters: {
			macs: {
				type: 'array',
				description: 'Array of MAC addresses to compare (2-4 devices)',
				required: true
			}
		},
		handler: 'client'
	},
	{
		name: 'suggestAction',
		description: 'Suggest an action to the operator with a clickable button.',
		parameters: {
			action: {
				type: 'string',
				description: 'Action label',
				required: true
			},
			description: {
				type: 'string',
				description: 'What this action does'
			},
			tool: {
				type: 'string',
				description: 'Tool to execute when clicked',
				required: true
			},
			parameters: {
				type: 'object',
				description: 'Parameters for the tool'
			}
		},
		handler: 'client'
	}
];

/**
 * Get frontend tools in MCP format for agent context
 */
export function getFrontendToolsForAgent(): Array<{
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		properties: Record<string, unknown>;
		required: string[];
	};
}> {
	return frontendTools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: {
			// Safe: Type literal narrowed to const for JSON schema type definition
			type: 'object' as const,
			properties: Object.entries(tool.parameters).reduce(
				(acc, [key, param]) => ({
					...acc,
					[key]: {
						type: param.type,
						description: param.description,
						...(param.enum ? { enum: param.enum } : {})
					}
				}),
				{}
			),
			required: Object.entries(tool.parameters)
				.filter(([, param]) => param.required)
				.map(([key]) => key)
		}
	}));
}

/** Check if a required parameter is missing */
function checkRequired(
	paramName: string,
	paramDef: FrontendTool['parameters'][string],
	parameters: Record<string, unknown>
): string | null {
	if (paramDef.required && !(paramName in parameters)) {
		return `Missing required parameter: ${paramName}`;
	}
	return null;
}

/** Check if a parameter value satisfies its enum constraint */
function checkEnum(
	paramName: string,
	paramDef: FrontendTool['parameters'][string],
	parameters: Record<string, unknown>
): string | null {
	if (!paramDef.enum || !(paramName in parameters)) return null;
	const value = parameters[paramName];
	if (!paramDef.enum.includes(String(value))) {
		return `Invalid value for ${paramName}. Expected one of: ${paramDef.enum.join(', ')}`;
	}
	return null;
}

/**
 * Validate frontend tool call parameters
 */
export function validateFrontendToolCall(
	toolName: string,
	parameters: Record<string, unknown>
): { valid: boolean; error?: string } {
	const tool = frontendTools.find((t) => t.name === toolName);
	if (!tool) return { valid: false, error: `Unknown frontend tool: ${toolName}` };

	for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
		const error =
			checkRequired(paramName, paramDef, parameters) ??
			checkEnum(paramName, paramDef, parameters);
		if (error) return { valid: false, error };
	}
	return { valid: true };
}
