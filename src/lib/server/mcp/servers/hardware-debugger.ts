#!/usr/bin/env node
/**
 * Hardware Debugger MCP Server (Consolidated)
 * Unified diagnostics for HackRF, Kismet, and GPS hardware
 * Replaces: hackrf-server.ts, kismet-server.ts, gps-server.ts
 */

import { config } from 'dotenv';
import { BaseMCPServer, type ToolDefinition } from '../shared/base-server';
import { apiFetch } from '../shared/api-client';

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

				// Parallel fetch all hardware statuses
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

				// Analyze each device
				const devices = [];
				const issues = [];
				const recommendations = [];

				// HackRF
				let hackrfHealth = 'HEALTHY';
				if (hackrf.status === 'unreachable') {
					hackrfHealth = 'ERROR';
					issues.push('HackRF API unreachable');
					recommendations.push('⚠️ Check: Is dev server running?');
				} else if (hackrf.connected === false || hackrf.status === 'disconnected') {
					hackrfHealth = 'DISCONNECTED';
					issues.push('HackRF not connected');
					recommendations.push('💡 Check USB connection and run: hackrf_info');
				} else if (hackrf.sweepActive) {
					hackrfHealth = 'ACTIVE';
				}

				devices.push({
					name: 'HackRF One',
					type: 'sdr',
					health: hackrfHealth,
					status: hackrf.status || 'unknown',
					details: detailed
						? {
								connected: hackrf.connected,
								sweep_active: hackrf.sweepActive,
								frequency: hackrf.frequency,
								sample_rate: hackrf.sampleRate
							}
						: undefined
				});

				// Kismet
				let kismetHealth = 'HEALTHY';
				if (kismet.status === 'unreachable') {
					kismetHealth = 'ERROR';
					issues.push('Kismet API unreachable');
				} else if (kismet.running === false || kismet.status === 'stopped') {
					kismetHealth = 'STOPPED';
					issues.push('Kismet service not running');
					recommendations.push('💡 Start with: /api/kismet/control (action: start)');
				} else if (kismet.device_count === 0) {
					kismetHealth = 'NO_DEVICES';
					issues.push('Kismet running but no devices detected');
					recommendations.push('💡 Check: Is ALFA adapter connected?');
				} else {
					kismetHealth = 'ACTIVE';
				}

				devices.push({
					name: 'Kismet WiFi Scanner',
					type: 'wifi',
					health: kismetHealth,
					status: kismet.status || 'unknown',
					details: detailed
						? {
								running: kismet.running,
								device_count: kismet.device_count,
								interface: kismet.interface,
								uptime: kismet.uptime
							}
						: undefined
				});

				// GPS
				let gpsHealth = 'HEALTHY';
				if (gps.fix === 0 || gps.mode === 0) {
					gpsHealth = 'NO_FIX';
					issues.push('GPS has no fix');
					recommendations.push(
						'💡 GPS needs clear sky view - may take 2-5 minutes outdoors'
					);
				} else if (gps.fix === 2) {
					gpsHealth = '2D_FIX';
					issues.push('GPS has 2D fix only (no altitude)');
				} else if (gps.fix === 3) {
					gpsHealth = 'HEALTHY';
				}

				devices.push({
					name: 'GPS Module',
					type: 'gps',
					health: gpsHealth,
					status: gps.fix > 0 ? 'fixed' : 'no-fix',
					details: detailed
						? {
								latitude: gps.latitude,
								longitude: gps.longitude,
								altitude: gps.altitude,
								satellites: gps.satellites,
								fix_quality: gps.fix
							}
						: undefined
				});

				// Check for hardware detection issues
				if (hwScan.hardware) {
					const sdrDevices = hwScan.hardware.sdr || [];
					const wifiDevices = hwScan.hardware.wifi || [];
					const gpsDevices = hwScan.hardware.gps || [];

					if (sdrDevices.length === 0 && hackrfHealth === 'DISCONNECTED') {
						recommendations.push(
							'🔴 NO SDR devices detected - check USB connection and permissions'
						);
					}
					if (wifiDevices.length === 0 && kismetHealth === 'NO_DEVICES') {
						recommendations.push(
							'🔴 NO WiFi adapters detected - check ALFA USB connection'
						);
					}
					if (gpsDevices.length === 0 && gpsHealth === 'NO_FIX') {
						recommendations.push('🔴 NO GPS devices detected - check USB connection');
					}
				}

				// Overall health
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
					recommendations.push('✅ All hardware operational');
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
			execute: async () => {
				const conflicts = [];
				const recommendations = [];

				// Check HackRF resource manager
				try {
					const hackrfResp = await apiFetch('/api/hackrf/status');
					const hackrf = await hackrfResp.json();

					if (hackrf.resourceLocked) {
						conflicts.push({
							device: 'HackRF',
							type: 'resource_lock',
							owner: hackrf.lockOwner || 'unknown',
							message: `HackRF locked by "${hackrf.lockOwner}"`
						});
						recommendations.push(
							`💡 Release HackRF: Stop the process using it or force-release via resource manager`
						);
					}
				} catch {
					// HackRF API unreachable
				}

				// Check Kismet port conflicts
				try {
					const kismetResp = await apiFetch('/api/kismet/status');
					const kismet = await kismetResp.json();

					if (kismet.status === 'error' && kismet.error?.includes('port')) {
						conflicts.push({
							device: 'Kismet',
							type: 'port_conflict',
							port: 2501,
							message: 'Kismet port 2501 may be in use'
						});
						recommendations.push(
							'💡 Check port 2501: lsof -i:2501 | Kill conflicting process'
						);
					}
				} catch {
					// Kismet API unreachable
				}

				// Check for USB device conflicts via hardware scan
				try {
					const hwResp = await apiFetch('/api/hardware/scan');
					const hwScan = await hwResp.json();

					if (hwScan.stats?.conflicts) {
						for (const conflict of hwScan.stats.conflicts) {
							conflicts.push({
								device: conflict.device,
								type: 'usb_conflict',
								message: conflict.message
							});
						}
					}
				} catch {
					// Hardware scan failed
				}

				if (conflicts.length === 0) {
					recommendations.push('✅ No hardware conflicts detected');
				}

				return {
					status: conflicts.length > 0 ? 'CONFLICTS_FOUND' : 'CLEAN',
					conflict_count: conflicts.length,
					conflicts,
					recommendations
				};
			}
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

				const recoverySteps: Record<string, unknown>[] = [];

				// HackRF recovery
				if (device === 'hackrf' || device === 'all') {
					recoverySteps.push({
						device: 'HackRF',
						steps: [
							{
								action: 'Check connection',
								command: 'hackrf_info',
								expected: 'Should show serial number and firmware version'
							},
							{
								action: 'Reset USB',
								command:
									'sudo usbreset $(lsusb | grep "HackRF" | awk \'{print $6}\')',
								expected: 'Device should reconnect'
							},
							{
								action: 'Kill stale processes',
								command: 'sudo pkill -f "hackrf_sweep|hackrf_transfer"',
								expected: 'Releases any locks'
							},
							{
								action: 'Test basic operation',
								command: 'hackrf_transfer -r /dev/null -f 915 -n 1000000',
								expected: 'Should receive samples without errors'
							}
						]
					});
				}

				// Kismet recovery
				if (device === 'kismet' || device === 'all') {
					recoverySteps.push({
						device: 'Kismet',
						steps: [
							{
								action: 'Stop service',
								command: 'sudo systemctl stop kismet',
								expected: 'Service should stop'
							},
							{
								action: 'Check ALFA adapter',
								command: 'lsusb | grep "Realtek"',
								expected: 'Should show ALFA adapter'
							},
							{
								action: 'Reset monitor mode',
								command:
									'sudo airmon-ng check kill && sudo airmon-ng stop wlan1mon && sudo airmon-ng start wlan1',
								expected: 'Monitor interface created'
							},
							{
								action: 'Restart service',
								command: 'sudo systemctl start kismet',
								expected: 'Service starts with monitor interface'
							}
						]
					});
				}

				// GPS recovery
				if (device === 'gps' || device === 'all') {
					recoverySteps.push({
						device: 'GPS',
						steps: [
							{
								action: 'Check USB connection',
								command: 'lsusb | grep "GPS\\|u-blox\\|GlobalSat"',
								expected: 'Should show GPS device'
							},
							{
								action: 'Check gpsd status',
								command: 'sudo systemctl status gpsd',
								expected: 'Service should be running'
							},
							{
								action: 'Restart gpsd',
								command: 'sudo systemctl restart gpsd',
								expected: 'Service restarts'
							},
							{
								action: 'Wait for fix',
								command: 'cgps -s',
								expected: 'Wait 2-5 minutes outdoors for satellite lock'
							}
						]
					});
				}

				return {
					device_filter: device,
					total_recovery_plans: recoverySteps.length,
					recovery_steps: recoverySteps,
					notes: [
						'💡 Run steps in order - later steps depend on earlier ones',
						'⚠️ Some commands require sudo privileges',
						'ℹ️ GPS fix requires clear sky view and may take several minutes'
					]
				};
			}
		},
		{
			name: 'test_hardware_capability',
			description:
				'Test if hardware can perform specific operation. Quick capability check without starting full operations. Use to verify hardware before launching scans or sweeps.',
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

				// Test HackRF sweep capability
				if (device === 'hackrf' && capability === 'sweep') {
					try {
						const resp = await apiFetch('/api/hackrf/status');
						const status = await resp.json();

						if (status.connected) {
							result.can_perform = true;
							result.reasons = [
								'✅ HackRF connected',
								'✅ Ready for sweep operations'
							];
						} else {
							result.reasons = [
								'❌ HackRF not connected',
								'💡 Check USB connection: hackrf_info'
							];
						}
					} catch {
						result.reasons = [
							'❌ Cannot reach HackRF API',
							'💡 Check if dev server is running'
						];
					}
				}

				// Test Kismet scan capability
				else if (device === 'kismet' && capability === 'scan') {
					try {
						const resp = await apiFetch('/api/kismet/status');
						const status = await resp.json();

						if (status.running && status.device_count > 0) {
							result.can_perform = true;
							result.reasons = [
								'✅ Kismet running',
								`✅ ${status.device_count} device(s) active`
							];
						} else if (!status.running) {
							result.reasons = [
								'❌ Kismet not running',
								'💡 Start service: /api/kismet/control (action: start)'
							];
						} else {
							result.reasons = [
								'❌ Kismet running but no devices',
								'💡 Check ALFA adapter connection'
							];
						}
					} catch {
						result.reasons = ['❌ Cannot reach Kismet API'];
					}
				}

				// Test GPS positioning capability
				else if (device === 'gps' && capability === 'positioning') {
					try {
						const resp = await apiFetch('/api/gps/position');
						const gps = await resp.json();

						if (gps.fix >= 2) {
							result.can_perform = true;
							result.reasons = [
								`✅ GPS fix quality: ${gps.fix === 3 ? '3D' : '2D'}`,
								`✅ ${gps.satellites || 0} satellites`
							];
						} else {
							result.reasons = [
								'❌ No GPS fix',
								'💡 Move to location with clear sky view',
								'⏱️ Fix may take 2-5 minutes'
							];
						}
					} catch {
						result.reasons = ['❌ Cannot reach GPS API'];
					}
				}

				// Unknown capability
				else {
					result.reasons = [
						`❌ Unknown capability "${capability}" for device "${device}"`
					];
				}

				return result;
			}
		},
		{
			name: 'quick_hardware_status',
			description:
				'Quick health summary for all hardware (non-diagnostic). Returns one-line status for HackRF, Kismet, GPS. Use for rapid status checks without full diagnostics.',
			inputSchema: {
				type: 'object' as const,
				properties: {}
			},
			execute: async () => {
				// Parallel fetch (optimized for speed)
				const [hackrfResp, kismetResp, gpsResp] = await Promise.all([
					apiFetch('/api/hackrf/status').catch(() => null),
					apiFetch('/api/kismet/status').catch(() => null),
					apiFetch('/api/gps/position').catch(() => null)
				]);

				const hackrf = hackrfResp ? await hackrfResp.json() : null;
				const kismet = kismetResp ? await kismetResp.json() : null;
				const gps = gpsResp ? await gpsResp.json() : null;

				const status = {
					hackrf: hackrf?.connected ? '🟢 Connected' : '🔴 Disconnected',
					kismet: kismet?.running
						? `🟢 Running (${kismet.device_count || 0} devices)`
						: '🔴 Stopped',
					gps: gps?.fix >= 2 ? `🟢 ${gps.fix === 3 ? '3D' : '2D'} Fix` : '🔴 No Fix',
					timestamp: new Date().toISOString()
				};

				return status;
			}
		}
	];
}

// Start server when run directly
const server = new HardwareDebugger('argos-hardware-debugger');
server.start().catch((error) => {
	console.error('[Hardware Debugger] Fatal:', error);
	process.exit(1);
});
