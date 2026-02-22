/**
 * Hardware Debugger MCP Server — tool handler implementations.
 * Extracted from hardware-debugger.ts for constitutional compliance (Article 2.2).
 */

import { apiFetch } from '../shared/api-client';

interface DeviceInfo {
	name: string;
	type: string;
	health: string;
	status: string;
	details?: Record<string, unknown>;
}

/**
 * Diagnose HackRF health from API status response.
 */
export function diagnoseHackrf(
	hackrf: Record<string, unknown>,
	detailed: boolean,
	issues: string[],
	recommendations: string[]
): DeviceInfo {
	let hackrfHealth = 'HEALTHY';
	if (hackrf.status === 'unreachable') {
		hackrfHealth = 'ERROR';
		issues.push('HackRF API unreachable');
		recommendations.push('Warning: Check: Is dev server running?');
	} else if (hackrf.connected === false || hackrf.status === 'disconnected') {
		hackrfHealth = 'DISCONNECTED';
		issues.push('HackRF not connected');
		recommendations.push('Check USB connection and run: hackrf_info');
	} else if (hackrf.sweepActive) {
		hackrfHealth = 'ACTIVE';
	}

	return {
		name: 'HackRF One',
		type: 'sdr',
		health: hackrfHealth,
		status: (hackrf.status as string) || 'unknown',
		details: detailed
			? {
					connected: hackrf.connected,
					sweep_active: hackrf.sweepActive,
					frequency: hackrf.frequency,
					sample_rate: hackrf.sampleRate
				}
			: undefined
	};
}

/**
 * Diagnose Kismet health from API status response.
 */
export function diagnoseKismet(
	kismet: Record<string, unknown>,
	detailed: boolean,
	issues: string[],
	recommendations: string[]
): DeviceInfo {
	let kismetHealth = 'HEALTHY';
	if (kismet.status === 'unreachable') {
		kismetHealth = 'ERROR';
		issues.push('Kismet API unreachable');
	} else if (kismet.isRunning === false || kismet.status === 'stopped') {
		kismetHealth = 'STOPPED';
		issues.push('Kismet service not running');
		recommendations.push('Start with: /api/kismet/control (action: start)');
	} else if (kismet.device_count === 0) {
		kismetHealth = 'NO_DEVICES';
		issues.push('Kismet running but no devices detected');
		recommendations.push('Check: Is ALFA adapter connected?');
	} else {
		kismetHealth = 'ACTIVE';
	}

	return {
		name: 'Kismet WiFi Scanner',
		type: 'wifi',
		health: kismetHealth,
		status: (kismet.status as string) || 'unknown',
		details: detailed
			? {
					isRunning: kismet.isRunning,
					device_count: kismet.device_count,
					interface: kismet.interface,
					uptime: kismet.uptime
				}
			: undefined
	};
}

/**
 * Diagnose GPS health from API position response.
 */
export function diagnoseGps(
	gps: Record<string, unknown>,
	detailed: boolean,
	issues: string[],
	recommendations: string[]
): DeviceInfo {
	let gpsHealth = 'HEALTHY';
	if (gps.fix === 0 || gps.mode === 0) {
		gpsHealth = 'NO_FIX';
		issues.push('GPS has no fix');
		recommendations.push('GPS needs clear sky view - may take 2-5 minutes outdoors');
	} else if (gps.fix === 2) {
		gpsHealth = '2D_FIX';
		issues.push('GPS has 2D fix only (no altitude)');
	} else if (gps.fix === 3) {
		gpsHealth = 'HEALTHY';
	}

	return {
		name: 'GPS Module',
		type: 'gps',
		health: gpsHealth,
		status: (gps.fix as number) > 0 ? 'fixed' : 'no-fix',
		details: detailed
			? {
					latitude: gps.latitude,
					longitude: gps.longitude,
					altitude: gps.altitude,
					satellites: gps.satellites,
					fix_quality: gps.fix
				}
			: undefined
	};
}

/**
 * Check hardware scan results for missing device recommendations.
 */
export function checkHardwareScan(
	hwScan: Record<string, unknown>,
	hackrfHealth: string,
	kismetHealth: string,
	gpsHealth: string,
	recommendations: string[]
): void {
	if (hwScan.hardware) {
		const hw = hwScan.hardware as Record<string, unknown[]>;
		const sdrDevices = hw.sdr || [];
		const wifiDevices = hw.wifi || [];
		const gpsDevices = hw.gps || [];

		if (sdrDevices.length === 0 && hackrfHealth === 'DISCONNECTED') {
			recommendations.push('NO SDR devices detected - check USB connection and permissions');
		}
		if (wifiDevices.length === 0 && kismetHealth === 'NO_DEVICES') {
			recommendations.push('NO WiFi adapters detected - check ALFA USB connection');
		}
		if (gpsDevices.length === 0 && gpsHealth === 'NO_FIX') {
			recommendations.push('NO GPS devices detected - check USB connection');
		}
	}
}

/**
 * Detect hardware resource conflicts (HackRF locks, Kismet ports, USB).
 */
export async function detectConflicts(): Promise<{
	status: string;
	conflict_count: number;
	conflicts: Record<string, unknown>[];
	recommendations: string[];
}> {
	const conflicts: Record<string, unknown>[] = [];
	const recommendations: string[] = [];

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
				'Release HackRF: Stop the process using it or force-release via resource manager'
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
			recommendations.push('Check port 2501: lsof -i:2501 | Kill conflicting process');
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
		recommendations.push('No hardware conflicts detected');
	}

	return {
		status: conflicts.length > 0 ? 'CONFLICTS_FOUND' : 'CLEAN',
		conflict_count: conflicts.length,
		conflicts,
		recommendations
	};
}

/**
 * Build recovery steps for a specific device type.
 */
export function buildRecoverySteps(device: string): {
	device_filter: string;
	total_recovery_plans: number;
	recovery_steps: Record<string, unknown>[];
	notes: string[];
} {
	const recoverySteps: Record<string, unknown>[] = [];

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
					command: 'sudo usbreset $(lsusb | grep "HackRF" | awk \'{print $6}\')',
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
			'Run steps in order - later steps depend on earlier ones',
			'Some commands require sudo privileges',
			'GPS fix requires clear sky view and may take several minutes'
		]
	};
}
