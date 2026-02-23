#!/usr/bin/env node
/**
 * Hardware Debugger MCP Server (Consolidated)
 * Unified diagnostics for HackRF, Kismet, and GPS hardware
 * Replaces: hackrf-server.ts, kismet-server.ts, gps-server.ts
 */

import { config } from 'dotenv';

import { logger } from '$lib/utils/logger';

import { apiFetch } from '../shared/api-client';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import {
	buildRecoverySteps,
	checkHardwareScan,
	detectConflicts,
	diagnoseGps,
	diagnoseHackrf,
	diagnoseKismet
} from './hardware-debugger-tools';

/** Fetch API JSON with unreachable fallback. */
async function fetchOrFallback(
	url: string,
	fallback: Record<string, unknown>
): Promise<Record<string, unknown>> {
	try {
		const resp = await apiFetch(url);
		return await resp.json();
	} catch {
		return fallback;
	}
}

/** Classify overall health from device health strings. */
function classifyOverallHealth(healthValues: string[]): string {
	const healthyCount = healthValues.filter((h) => h === 'HEALTHY' || h === 'ACTIVE').length;
	if (healthyCount === healthValues.length) return 'HEALTHY';
	return healthyCount > 0 ? 'DEGRADED' : 'CRITICAL';
}

interface CapabilityResult {
	can_perform: boolean;
	reasons: string[];
}

/** Check HackRF sweep capability. */
async function checkHackrfSweep(): Promise<CapabilityResult> {
	try {
		const resp = await apiFetch('/api/hackrf/status');
		const status = await resp.json();
		if (status.connected)
			return {
				can_perform: true,
				reasons: ['HackRF connected', 'Ready for sweep operations']
			};
		return { can_perform: false, reasons: ['HackRF not connected', 'Check USB: hackrf_info'] };
	} catch {
		return { can_perform: false, reasons: ['Cannot reach HackRF API', 'Check dev server'] };
	}
}

/** Check Kismet scan capability. */
async function checkKismetScan(): Promise<CapabilityResult> {
	try {
		const resp = await apiFetch('/api/kismet/status');
		const status = await resp.json();
		if (status.isRunning && status.device_count > 0)
			return {
				can_perform: true,
				reasons: ['Kismet running', `${status.device_count} device(s) active`]
			};
		if (!status.isRunning)
			return {
				can_perform: false,
				reasons: ['Kismet not running', 'Start: /api/kismet/control']
			};
		return {
			can_perform: false,
			reasons: ['Kismet running but no devices', 'Check ALFA adapter']
		};
	} catch {
		return { can_perform: false, reasons: ['Cannot reach Kismet API'] };
	}
}

/** Check GPS positioning capability. */
async function checkGpsPositioning(): Promise<CapabilityResult> {
	try {
		const resp = await apiFetch('/api/gps/position');
		const gps = await resp.json();
		if (gps.fix >= 2) {
			const fixType = gps.fix === 3 ? '3D' : '2D';
			return {
				can_perform: true,
				reasons: [`GPS fix: ${fixType}`, `${gps.satellites || 0} satellites`]
			};
		}
		return {
			can_perform: false,
			reasons: ['No GPS fix', 'Move to clear sky', 'Fix may take 2-5 min']
		};
	} catch {
		return { can_perform: false, reasons: ['Cannot reach GPS API'] };
	}
}

/** Dispatch map for device:capability pairs. */
const CAPABILITY_CHECKERS: Record<string, () => Promise<CapabilityResult>> = {
	'hackrf:sweep': checkHackrfSweep,
	'kismet:scan': checkKismetScan,
	'gps:positioning': checkGpsPositioning
};

/** One-line HackRF status. */
function summarizeHackrf(hackrf: Record<string, unknown>): string {
	return hackrf.connected ? 'Connected' : 'Disconnected';
}

/** One-line Kismet status. */
function summarizeKismet(kismet: Record<string, unknown>): string {
	if (!kismet.isRunning) return 'Stopped';
	return `Running (${kismet.device_count || 0} devices)`;
}

/** One-line GPS status. */
function summarizeGps(gps: Record<string, unknown>): string {
	if ((gps.fix as number) < 2) return 'No Fix';
	const fixType = gps.fix === 3 ? '3D' : '2D';
	return `${fixType} Fix`;
}

// Load .env for ARGOS_API_KEY
config();

class HardwareDebugger extends BaseMCPServer {
	protected tools: ToolDefinition[] = [
		{
			name: 'diagnose_hardware',
			description:
				'Run complete hardware health check for HackRF, Kismet, and GPS. Returns connection status, conflicts, operational issues, and recovery recommendations. Use this FIRST when investigating hardware problems.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					detailed: {
						type: 'boolean',
						description: 'Include detailed diagnostics (default: true)'
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const detailed = args.detailed !== false;

				const [hackrf, kismet, gps, hwScan] = await Promise.all([
					fetchOrFallback('/api/hackrf/status', { status: 'unreachable' }),
					fetchOrFallback('/api/kismet/status', { status: 'unreachable' }),
					fetchOrFallback('/api/gps/position', { fix: 0 }),
					fetchOrFallback('/api/hardware/scan', { hardware: {} })
				]);

				const issues: string[] = [];
				const recommendations: string[] = [];

				const hackrfDevice = diagnoseHackrf(hackrf, detailed, issues, recommendations);
				const kismetDevice = diagnoseKismet(kismet, detailed, issues, recommendations);
				const gpsDevice = diagnoseGps(gps, detailed, issues, recommendations);
				const devices = [hackrfDevice, kismetDevice, gpsDevice];

				checkHardwareScan(
					hwScan,
					{ sdr: hackrfDevice.health, wifi: kismetDevice.health, gps: gpsDevice.health },
					recommendations
				);

				const overallHealth = classifyOverallHealth(devices.map((d) => d.health));
				if (recommendations.length === 0) recommendations.push('All hardware operational');

				return {
					overall_health: overallHealth,
					timestamp: new Date().toISOString(),
					summary: {
						total_devices: devices.length,
						healthy: devices.filter(
							(d) => d.health === 'HEALTHY' || d.health === 'ACTIVE'
						).length,
						issues: issues.length
					},
					devices,
					issues,
					recommendations
				};
			}
		},
		{
			name: 'detect_conflicts',
			description:
				'Detect hardware resource conflicts. Checks for USB contention, port conflicts, and process locks. Use when multiple tools fail to access hardware simultaneously.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => detectConflicts()
		},
		{
			name: 'suggest_recovery',
			description:
				'Get auto-recovery suggestions for failed hardware. Analyzes failure modes and provides specific commands to fix common issues. Use after diagnose_hardware shows errors.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					device: {
						type: 'string',
						description: 'Specific device to recover: hackrf, kismet, gps, or all',
						enum: ['hackrf', 'kismet', 'gps', 'all']
					}
				}
			},
			execute: async (args: Record<string, unknown>) => {
				const device = (args.device as string) || 'all';
				return buildRecoverySteps(device);
			}
		},
		{
			name: 'test_hardware_capability',
			description:
				'Test if hardware can perform specific operation. Quick capability check without starting full operations.',
			inputSchema: {
				type: 'object' as const,
				properties: {
					device: {
						type: 'string',
						description: 'Device to test',
						enum: ['hackrf', 'kismet', 'gps']
					},
					capability: {
						type: 'string',
						description: 'Capability to test: sweep, scan, positioning, etc.'
					}
				},
				required: ['device', 'capability']
			},
			execute: async (args: Record<string, unknown>) => {
				const device = args.device as string;
				const capability = args.capability as string;
				const checker = CAPABILITY_CHECKERS[`${device}:${capability}`];
				if (!checker) {
					return {
						device,
						capability,
						can_perform: false,
						reasons: [`Unknown capability "${capability}" for device "${device}"`]
					};
				}
				const { can_perform, reasons } = await checker();
				return { device, capability, can_perform, reasons };
			}
		},
		{
			name: 'quick_hardware_status',
			description:
				'Quick health summary for all hardware (non-diagnostic). Returns one-line status for HackRF, Kismet, GPS.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				const [hackrf, kismet, gps] = await Promise.all([
					fetchOrFallback('/api/hackrf/status', {}),
					fetchOrFallback('/api/kismet/status', {}),
					fetchOrFallback('/api/gps/position', {})
				]);
				return {
					hackrf: summarizeHackrf(hackrf),
					kismet: summarizeKismet(kismet),
					gps: summarizeGps(gps),
					timestamp: new Date().toISOString()
				};
			}
		}
	];
}

// Start server when run directly
const server = new HardwareDebugger('argos-hardware-debugger');
server.start().catch((error) => {
	logger.error('Hardware Debugger fatal error', {
		error: error instanceof Error ? error.message : String(error)
	});
	process.exit(1);
});
