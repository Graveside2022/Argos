/**
 * Frontend Tool Executor
 * Handles execution of frontend tools called by the agent
 */

import type { Map as LeafletMap } from 'leaflet';

import {
	clearWorkflow,
	nextWorkflowStep,
	selectedDeviceMAC,
	setWorkflow,
	type WorkflowType
} from '$lib/stores/dashboard/agent-context-store';

export interface FrontendToolCall {
	tool: string;
	parameters: Record<string, any>;
}

export interface FrontendToolResult {
	success: boolean;
	message?: string;
	error?: string;
}

/**
 * Frontend Tool Executor
 * Executes UI manipulation tools called by the agent
 */
export class FrontendToolExecutor {
	private map: LeafletMap | null = null;
	private highlightedDevices = new Set<string>();
	private customMarkers: any[] = [];

	/**
	 * Set the Leaflet map instance for map-related tools
	 */
	setMap(map: LeafletMap) {
		this.map = map;
	}

	/**
	 * Execute a frontend tool
	 */
	async execute(toolCall: FrontendToolCall): Promise<FrontendToolResult> {
		const { tool, parameters } = toolCall;

		console.log('[FrontendToolExecutor] Executing:', tool, parameters);

		try {
			switch (tool) {
				case 'highlightDevice':
					return this.highlightDevice(
						parameters.mac,
						parameters.duration,
						parameters.color
					);

				case 'zoomToLocation':
					return this.zoomToLocation(parameters.lat, parameters.lon, parameters.zoom);

				case 'zoomToDevice':
					return this.zoomToDevice(parameters.mac, parameters.zoom);

				case 'showAlert':
					return this.showAlert(parameters.message, parameters.type, parameters.duration);

				case 'setWorkflow':
					return this.setWorkflowHandler(parameters.workflow, parameters.goal);

				case 'nextWorkflowStep':
					return this.nextWorkflowStepHandler();

				case 'clearWorkflow':
					return this.clearWorkflowHandler();

				case 'filterDevices':
					return this.filterDevices(
						parameters.type,
						parameters.signalStrength,
						parameters.encryption
					);

				case 'showDeviceDetails':
					return this.showDeviceDetails(parameters.mac);

				case 'createMarker':
					return this.createMarker(
						parameters.lat,
						parameters.lon,
						parameters.label,
						parameters.type
					);

				case 'drawCircle':
					return this.drawCircle(
						parameters.lat,
						parameters.lon,
						parameters.radius,
						parameters.label
					);

				case 'startMonitoring':
					return this.startMonitoring(
						parameters.target,
						parameters.type,
						parameters.duration
					);

				case 'compareDevices':
					return this.compareDevices(parameters.macs);

				case 'suggestAction':
					return this.suggestAction(
						parameters.action,
						parameters.description,
						parameters.tool,
						parameters.parameters
					);

				default:
					return {
						success: false,
						error: `Unknown frontend tool: ${tool}`
					};
			}
		} catch (error) {
			console.error('[FrontendToolExecutor] Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	// ============================================================================
	// Tool Implementations
	// ============================================================================

	private highlightDevice(
		mac: string,
		duration: number = 3000,
		color: string = 'yellow'
	): FrontendToolResult {
		// Select the device
		selectedDeviceMAC.set(mac);

		// Add to highlighted set
		this.highlightedDevices.add(mac);

		// Emit custom event for map component to handle
		window.dispatchEvent(
			new CustomEvent('argos:highlightDevice', {
				detail: { mac, color, duration }
			})
		);

		// Auto-remove highlight after duration
		setTimeout(() => {
			this.highlightedDevices.delete(mac);
			window.dispatchEvent(new CustomEvent('argos:unhighlightDevice', { detail: { mac } }));
		}, duration);

		return {
			success: true,
			message: `Highlighted device ${mac} for ${duration}ms`
		};
	}

	private zoomToLocation(lat: number, lon: number, zoom: number = 16): FrontendToolResult {
		if (!this.map) {
			return { success: false, error: 'Map not initialized' };
		}

		this.map.setView([lat, lon], zoom);

		return {
			success: true,
			message: `Zoomed to location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`
		};
	}

	private zoomToDevice(mac: string, zoom: number = 17): FrontendToolResult {
		// Emit event for map component to handle
		// The map component knows device locations from Kismet store
		window.dispatchEvent(
			new CustomEvent('argos:zoomToDevice', {
				detail: { mac, zoom }
			})
		);

		selectedDeviceMAC.set(mac);

		return {
			success: true,
			message: `Zooming to device ${mac}`
		};
	}

	private showAlert(
		message: string,
		type: string = 'info',
		duration: number = 5000
	): FrontendToolResult {
		// Emit alert event for UI to handle
		window.dispatchEvent(
			new CustomEvent('argos:showAlert', {
				detail: { message, type, duration }
			})
		);

		return {
			success: true,
			message: 'Alert displayed'
		};
	}

	private setWorkflowHandler(workflow: string, goal?: string): FrontendToolResult {
		setWorkflow(workflow as WorkflowType, goal);

		return {
			success: true,
			message: `Workflow set to: ${workflow}`
		};
	}

	private nextWorkflowStepHandler(): FrontendToolResult {
		nextWorkflowStep();

		return {
			success: true,
			message: 'Advanced to next workflow step'
		};
	}

	private clearWorkflowHandler(): FrontendToolResult {
		clearWorkflow();

		return {
			success: true,
			message: 'Workflow cleared'
		};
	}

	private filterDevices(
		type?: string,
		signalStrength?: string,
		encryption?: string
	): FrontendToolResult {
		// Emit filter event for device list component
		window.dispatchEvent(
			new CustomEvent('argos:filterDevices', {
				detail: { type, signalStrength, encryption }
			})
		);

		return {
			success: true,
			message: 'Device filters applied'
		};
	}

	private showDeviceDetails(mac: string): FrontendToolResult {
		selectedDeviceMAC.set(mac);

		// Emit event to open device details panel
		window.dispatchEvent(
			new CustomEvent('argos:showDeviceDetails', {
				detail: { mac }
			})
		);

		return {
			success: true,
			message: `Showing details for device ${mac}`
		};
	}

	private createMarker(
		lat: number,
		lon: number,
		label: string,
		type: string = 'waypoint'
	): FrontendToolResult {
		window.dispatchEvent(
			new CustomEvent('argos:createMarker', {
				detail: { lat, lon, label, type }
			})
		);

		return {
			success: true,
			message: `Created ${type} marker: ${label}`
		};
	}

	private drawCircle(
		lat: number,
		lon: number,
		radius: number,
		label?: string
	): FrontendToolResult {
		window.dispatchEvent(
			new CustomEvent('argos:drawCircle', {
				detail: { lat, lon, radius, label }
			})
		);

		return {
			success: true,
			message: `Drew circle with ${radius}m radius at ${lat.toFixed(4)}, ${lon.toFixed(4)}`
		};
	}

	private startMonitoring(target: string, type?: string, duration?: number): FrontendToolResult {
		window.dispatchEvent(
			new CustomEvent('argos:startMonitoring', {
				detail: { target, type, duration }
			})
		);

		return {
			success: true,
			message: `Started monitoring ${target}`
		};
	}

	private compareDevices(macs: string[]): FrontendToolResult {
		if (!Array.isArray(macs) || macs.length < 2 || macs.length > 4) {
			return {
				success: false,
				error: 'compareDevices requires 2-4 device MAC addresses'
			};
		}

		window.dispatchEvent(
			new CustomEvent('argos:compareDevices', {
				detail: { macs }
			})
		);

		return {
			success: true,
			message: `Comparing ${macs.length} devices`
		};
	}

	private suggestAction(
		action: string,
		description: string,
		tool: string,
		parameters: any
	): FrontendToolResult {
		// Emit event that UI can display as a clickable action button
		window.dispatchEvent(
			new CustomEvent('argos:suggestAction', {
				detail: { action, description, tool, parameters }
			})
		);

		return {
			success: true,
			message: `Suggested action: ${action}`
		};
	}
}

/**
 * Global frontend tool executor instance
 */
export const frontendToolExecutor = new FrontendToolExecutor();
