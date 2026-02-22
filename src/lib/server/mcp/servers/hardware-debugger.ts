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

				const [hackrfResp, kismetResp, gpsResp, hwScanResp] = await Promise.all([
					apiFetch('/api/hackrf/status').catch(() => null),
					apiFetch('/api/kismet/status').catch(() => null),
					apiFetch('/api/gps/position').catch(() => null),
					apiFetch('/api/hardware/scan').catch(() => null)
				]);

				const hackrf = hackrfResp ? await hackrfResp.json() : { status: 'unreachable' };
				const kismet = kismetResp ? await kismetResp.json() : { status: 'unreachable' };
				const gps = gpsResp ? await gpsResp.json() : { fix: 0 };
				const hwScan = hwScanResp ? await hwScanResp.json() : { hardware: {} };

				const issues: string[] = [];
				const recommendations: string[] = [];

				const hackrfDevice = diagnoseHackrf(hackrf, detailed, issues, recommendations);
				const kismetDevice = diagnoseKismet(kismet, detailed, issues, recommendations);
				const gpsDevice = diagnoseGps(gps, detailed, issues, recommendations);
				const devices = [hackrfDevice, kismetDevice, gpsDevice];

				checkHardwareScan(
					hwScan,
					hackrfDevice.health,
					kismetDevice.health,
					gpsDevice.health,
					recommendations
				);

				const healthyCount = devices.filter(
					(d) => d.health === 'HEALTHY' || d.health === 'ACTIVE'
				).length;
				const overallHealth =
					healthyCount === devices.length
						? 'HEALTHY'
						: healthyCount > 0
							? 'DEGRADED'
							: 'CRITICAL';

				if (recommendations.length === 0) {
					recommendations.push('All hardware operational');
				}

				return {
					overall_health: overallHealth,
					timestamp: new Date().toISOString(),
					summary: {
						total_devices: devices.length,
						healthy: healthyCount,
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
				const result: Record<string, unknown> = {
					device,
					capability,
					can_perform: false,
					reasons: []
				};

				if (device === 'hackrf' && capability === 'sweep') {
					try {
						const resp = await apiFetch('/api/hackrf/status');
						const status = await resp.json();
						if (status.connected) {
							result.can_perform = true;
							result.reasons = ['HackRF connected', 'Ready for sweep operations'];
						} else {
							result.reasons = ['HackRF not connected', 'Check USB: hackrf_info'];
						}
					} catch {
						result.reasons = ['Cannot reach HackRF API', 'Check dev server'];
					}
				} else if (device === 'kismet' && capability === 'scan') {
					try {
						const resp = await apiFetch('/api/kismet/status');
						const status = await resp.json();
						if (status.isRunning && status.device_count > 0) {
							result.can_perform = true;
							result.reasons = [
								'Kismet running',
								`${status.device_count} device(s) active`
							];
						} else if (!status.isRunning) {
							result.reasons = ['Kismet not running', 'Start: /api/kismet/control'];
						} else {
							result.reasons = [
								'Kismet running but no devices',
								'Check ALFA adapter'
							];
						}
					} catch {
						result.reasons = ['Cannot reach Kismet API'];
					}
				} else if (device === 'gps' && capability === 'positioning') {
					try {
						const resp = await apiFetch('/api/gps/position');
						const gps = await resp.json();
						if (gps.fix >= 2) {
							result.can_perform = true;
							result.reasons = [
								`GPS fix: ${gps.fix === 3 ? '3D' : '2D'}`,
								`${gps.satellites || 0} satellites`
							];
						} else {
							result.reasons = [
								'No GPS fix',
								'Move to clear sky',
								'Fix may take 2-5 min'
							];
						}
					} catch {
						result.reasons = ['Cannot reach GPS API'];
					}
				} else {
					result.reasons = [`Unknown capability "${capability}" for device "${device}"`];
				}

				return result;
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
				const [hackrfResp, kismetResp, gpsResp] = await Promise.all([
					apiFetch('/api/hackrf/status').catch(() => null),
					apiFetch('/api/kismet/status').catch(() => null),
					apiFetch('/api/gps/position').catch(() => null)
				]);

				const hackrf = hackrfResp ? await hackrfResp.json() : null;
				const kismet = kismetResp ? await kismetResp.json() : null;
				const gps = gpsResp ? await gpsResp.json() : null;

				return {
					hackrf: hackrf?.connected ? 'Connected' : 'Disconnected',
					kismet: kismet?.isRunning
						? `Running (${kismet.device_count || 0} devices)`
						: 'Stopped',
					gps: gps?.fix >= 2 ? `${gps.fix === 3 ? '3D' : '2D'} Fix` : 'No Fix',
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
