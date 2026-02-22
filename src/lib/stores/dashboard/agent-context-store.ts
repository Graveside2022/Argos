import { derived, writable } from 'svelte/store';

import { gpsStore } from '$lib/stores/tactical-map/gps-store';
import { kismetStore } from '$lib/stores/tactical-map/kismet-store';

/**
 * Agent Context Store - AG-UI Shared State Bridge
 *
 * This store implements the AG-UI shared state pattern, providing bidirectional
 * context synchronization between the Argos UI and the agent (Claude AI).
 *
 * Architecture:
 * - Captures UI interactions (device clicks, map state, etc.)
 * - Aggregates tactical context (GPS location, active signals, Kismet status)
 * - Provides structured context for agent prompts
 * - Enables workflow-aware agent behavior
 */

// ============================================================================
// Selected Entity Stores
// ============================================================================

/**
 * MAC address of the currently selected device (when operator clicks a device on map)
 */
export const selectedDeviceMAC = writable<string | null>(null);

/**
 * Type of interaction that triggered the last context update
 */
export interface InteractionEvent {
	type: 'device_selected' | 'tower_selected' | 'area_selected' | 'manual_query';
	data: Record<string, unknown>;
	timestamp: number;
}

/**
 * Last interaction event - used to trigger auto-queries in the chat panel
 */
export const lastInteractionEvent = writable<InteractionEvent | null>(null);

// ============================================================================
// Workflow Context
// ============================================================================

/**
 * Current workflow the operator is engaged in (enables workflow-aware agent responses)
 */
export type WorkflowType =
	| 'reconnaissance'
	| 'device_investigation'
	| 'threat_analysis'
	| 'network_mapping'
	| 'rogue_ap_detection'
	| 'imsi_catcher_detection'
	| null;

export const currentWorkflow = writable<WorkflowType>(null);
export const workflowStep = writable<number>(0);
export const workflowGoal = writable<string>('');

// ============================================================================
// Derived Context - Full Device Details
// ============================================================================

/**
 * Full device details derived from kismetStore when a device is selected
 * This provides rich context about the selected device for the agent
 */
export const selectedDeviceDetails = derived(
	[selectedDeviceMAC, kismetStore],
	([$mac, $kismet]) => {
		if (!$mac) return null;

		// Find device in Kismet store
		const device = $kismet.devices.get($mac);
		if (!device) return null;

		// Extract relevant device details for agent context
		// Cast raw Kismet fields to Record for dotted-key access (index signature is unknown)
		const raw = device as Record<string, unknown>;
		const dot11 = raw['dot11.device'] as Record<string, unknown> | undefined;
		const baseSignal = raw['kismet.device.base.signal'] as Record<string, unknown> | undefined;
		const ssidMap = dot11?.['dot11.device.advertised_ssid_map'] as
			| Record<string, unknown>[]
			| undefined;

		return {
			mac: device.mac || $mac,
			ssid:
				device.ssid || (dot11?.['dot11.device.last_beaconed_ssid'] as string) || 'Unknown',
			type: device.type || (raw['kismet.device.base.type'] as string) || 'unknown',
			manufacturer:
				device.manufacturer ||
				device.manuf ||
				(raw['kismet.device.base.manuf'] as string) ||
				'Unknown',
			signal:
				device.signal?.last_signal ??
				(baseSignal?.['kismet.common.signal.last_signal'] as number) ??
				null,
			signalDbm:
				device.signal?.last_signal ??
				(baseSignal?.['kismet.common.signal.last_signal'] as number) ??
				null,
			channel: device.channel || (raw['kismet.device.base.channel'] as string) || null,
			frequency: device.frequency || (raw['kismet.device.base.frequency'] as number) || null,
			packets: device.packets || (raw['kismet.device.base.packets.total'] as number) || 0,
			encryption:
				device.encryption ||
				(ssidMap?.[0]?.['dot11.advertisedssid.crypt_set'] as string) ||
				null,
			lastSeen: device.last_seen || (raw['kismet.device.base.last_time'] as number) || null,
			firstSeen: device.first_seen || (raw['kismet.device.base.first_time'] as number) || null
		};
	}
);

// ============================================================================
// Aggregated Agent Context (AG-UI Shared State)
// ============================================================================

/**
 * Complete agent context - this is the AG-UI "shared state" that gets passed
 * to the agent with every message. It provides full situational awareness.
 */
export const agentContext = derived(
	[
		selectedDeviceMAC,
		selectedDeviceDetails,
		gpsStore,
		kismetStore,
		currentWorkflow,
		workflowStep,
		workflowGoal
	],
	([$mac, $device, $gps, $kismet, $workflow, $step, $goal]) => ({
		// Selected entity context
		selectedDevice: $mac,
		selectedDeviceDetails: $device,

		// Operator location context
		userLocation:
			$gps.position.lat !== 0 || $gps.position.lon !== 0
				? {
						lat: $gps.position.lat,
						lon: $gps.position.lon,
						accuracy: $gps.status.accuracy,
						heading: $gps.status.heading,
						speed: $gps.status.speed
					}
				: null,

		// Tactical environment context
		activeSignals: $kismet.deviceCount,
		kismetStatus: {
			connected: $kismet.status === 'running',
			status: $kismet.status,
			message: $kismet.message
		},

		// Workflow context (enables workflow-aware agent behavior)
		currentWorkflow: $workflow,
		workflowStep: $step,
		workflowGoal: $goal,

		// Timestamp
		timestamp: Date.now()
	})
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reset selected device and clear interaction event
 */
export function clearSelection() {
	selectedDeviceMAC.set(null);
	lastInteractionEvent.set(null);
}

/**
 * Set a device as selected (triggered by map clicks)
 */
export function selectDevice(mac: string, deviceData?: Record<string, unknown>) {
	selectedDeviceMAC.set(mac);
	lastInteractionEvent.set({
		type: 'device_selected',
		data: deviceData || { mac },
		timestamp: Date.now()
	});
}

/**
 * Set the current workflow context
 */
export function setWorkflow(workflow: WorkflowType, goal?: string) {
	currentWorkflow.set(workflow);
	workflowStep.set(0);
	if (goal) {
		workflowGoal.set(goal);
	}
}

/**
 * Advance to the next workflow step
 */
export function nextWorkflowStep() {
	workflowStep.update((n) => n + 1);
}

/**
 * Reset workflow context
 */
export function clearWorkflow() {
	currentWorkflow.set(null);
	workflowStep.set(0);
	workflowGoal.set('');
}
