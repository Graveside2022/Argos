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
/** Classify HackRF health state. */
function classifyHackrfHealth(hackrf: Record<string, unknown>): {
	health: string;
	issue?: string;
	rec?: string;
} {
	if (hackrf.status === 'unreachable')
		return {
			health: 'ERROR',
			issue: 'HackRF API unreachable',
			rec: 'Warning: Check: Is dev server running?'
		};
	if (hackrf.connected === false || hackrf.status === 'disconnected')
		return {
			health: 'DISCONNECTED',
			issue: 'HackRF not connected',
			rec: 'Check USB connection and run: hackrf_info'
		};
	if (hackrf.sweepActive) return { health: 'ACTIVE' };
	return { health: 'HEALTHY' };
}

export function diagnoseHackrf(
	hackrf: Record<string, unknown>,
	detailed: boolean,
	issues: string[],
	recommendations: string[]
): DeviceInfo {
	const { health, issue, rec } = classifyHackrfHealth(hackrf);
	if (issue) issues.push(issue);
	if (rec) recommendations.push(rec);
	return {
		name: 'HackRF One',
		type: 'sdr',
		health,
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

/** Classify Kismet health state. */
function classifyKismetHealth(kismet: Record<string, unknown>): {
	health: string;
	issue?: string;
	rec?: string;
} {
	if (kismet.status === 'unreachable')
		return { health: 'ERROR', issue: 'Kismet API unreachable' };
	if (kismet.isRunning === false || kismet.status === 'stopped')
		return {
			health: 'STOPPED',
			issue: 'Kismet service not running',
			rec: 'Start with: /api/kismet/control (action: start)'
		};
	if (kismet.device_count === 0)
		return {
			health: 'NO_DEVICES',
			issue: 'Kismet running but no devices detected',
			rec: 'Check: Is ALFA adapter connected?'
		};
	return { health: 'ACTIVE' };
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
	const { health, issue, rec } = classifyKismetHealth(kismet);
	if (issue) issues.push(issue);
	if (rec) recommendations.push(rec);
	return {
		name: 'Kismet WiFi Scanner',
		type: 'wifi',
		health,
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

/** Classify GPS health state. */
function classifyGpsHealth(gps: Record<string, unknown>): {
	health: string;
	issue?: string;
	rec?: string;
} {
	if (gps.fix === 0 || gps.mode === 0)
		return {
			health: 'NO_FIX',
			issue: 'GPS has no fix',
			rec: 'GPS needs clear sky view - may take 2-5 minutes outdoors'
		};
	if (gps.fix === 2) return { health: '2D_FIX', issue: 'GPS has 2D fix only (no altitude)' };
	return { health: 'HEALTHY' };
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
	const { health, issue, rec } = classifyGpsHealth(gps);
	if (issue) issues.push(issue);
	if (rec) recommendations.push(rec);
	return {
		name: 'GPS Module',
		type: 'gps',
		health,
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

/** Missing-device recommendation rules. */
const MISSING_DEVICE_RULES: Array<{
	category: string;
	healthMatch: string;
	message: string;
}> = [
	{
		category: 'sdr',
		healthMatch: 'DISCONNECTED',
		message: 'NO SDR devices detected - check USB connection and permissions'
	},
	{
		category: 'wifi',
		healthMatch: 'NO_DEVICES',
		message: 'NO WiFi adapters detected - check ALFA USB connection'
	},
	{
		category: 'gps',
		healthMatch: 'NO_FIX',
		message: 'NO GPS devices detected - check USB connection'
	}
];

/**
 * Check hardware scan results for missing device recommendations.
 */
/** Check if a device category is missing and matches its health state. */
function isMissingDevice(
	hw: Record<string, unknown[]>,
	healthMap: Record<string, string>,
	rule: (typeof MISSING_DEVICE_RULES)[number]
): boolean {
	const devices = hw[rule.category] || [];
	return devices.length === 0 && healthMap[rule.category] === rule.healthMatch;
}

export function checkHardwareScan(
	hwScan: Record<string, unknown>,
	healthMap: Record<string, string>,
	recommendations: string[]
): void {
	if (!hwScan.hardware) return;
	const hw = hwScan.hardware as Record<string, unknown[]>;
	for (const rule of MISSING_DEVICE_RULES) {
		if (isMissingDevice(hw, healthMap, rule)) recommendations.push(rule.message);
	}
}

interface ConflictEntry {
	device: string;
	type: string;
	message: string;
	[key: string]: unknown;
}

/** Check HackRF resource lock conflicts. */
async function checkHackrfConflicts(): Promise<{ conflicts: ConflictEntry[]; recs: string[] }> {
	try {
		const resp = await apiFetch('/api/hackrf/status');
		const hackrf = await resp.json();
		if (!hackrf.resourceLocked) return { conflicts: [], recs: [] };
		return {
			conflicts: [
				{
					device: 'HackRF',
					type: 'resource_lock',
					owner: hackrf.lockOwner || 'unknown',
					message: `HackRF locked by "${hackrf.lockOwner}"`
				}
			],
			recs: [
				'Release HackRF: Stop the process using it or force-release via resource manager'
			]
		};
	} catch {
		return { conflicts: [], recs: [] };
	}
}

/** Check Kismet port conflicts. */
async function checkKismetConflicts(): Promise<{ conflicts: ConflictEntry[]; recs: string[] }> {
	try {
		const resp = await apiFetch('/api/kismet/status');
		const kismet = await resp.json();
		if (!(kismet.status === 'error' && kismet.error?.includes('port')))
			return { conflicts: [], recs: [] };
		return {
			conflicts: [
				{
					device: 'Kismet',
					type: 'port_conflict',
					port: 2501,
					message: 'Kismet port 2501 may be in use'
				}
			],
			recs: ['Check port 2501: lsof -i:2501 | Kill conflicting process']
		};
	} catch {
		return { conflicts: [], recs: [] };
	}
}

/** Check USB device conflicts from hardware scan. */
async function checkUsbConflicts(): Promise<{ conflicts: ConflictEntry[]; recs: string[] }> {
	try {
		const resp = await apiFetch('/api/hardware/scan');
		const hwScan = await resp.json();
		if (!hwScan.stats?.conflicts) return { conflicts: [], recs: [] };
		const conflicts = (
			hwScan.stats.conflicts as Array<{ device: string; message: string }>
		).map((c) => ({ device: c.device, type: 'usb_conflict', message: c.message }));
		return { conflicts, recs: [] };
	} catch {
		return { conflicts: [], recs: [] };
	}
}

/**
 * Detect hardware resource conflicts (HackRF locks, Kismet ports, USB).
 */
export async function detectConflicts(): Promise<{
	status: string;
	conflict_count: number;
	conflicts: ConflictEntry[];
	recommendations: string[];
}> {
	const results = await Promise.all([
		checkHackrfConflicts(),
		checkKismetConflicts(),
		checkUsbConflicts()
	]);
	const conflicts = results.flatMap((r) => r.conflicts);
	const recommendations = results.flatMap((r) => r.recs);
	if (conflicts.length === 0) recommendations.push('No hardware conflicts detected');
	return {
		status: conflicts.length > 0 ? 'CONFLICTS_FOUND' : 'CLEAN',
		conflict_count: conflicts.length,
		conflicts,
		recommendations
	};
}

/** Recovery plan definitions keyed by device type. */
const RECOVERY_PLANS: Record<string, Record<string, unknown>> = {
	hackrf: {
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
	},
	kismet: {
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
	},
	gps: {
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
	}
};

const RECOVERY_NOTES = [
	'Run steps in order - later steps depend on earlier ones',
	'Some commands require sudo privileges',
	'GPS fix requires clear sky view and may take several minutes'
];

/**
 * Build recovery steps for a specific device type.
 */
export function buildRecoverySteps(device: string): {
	device_filter: string;
	total_recovery_plans: number;
	recovery_steps: Record<string, unknown>[];
	notes: string[];
} {
	const keys = device === 'all' ? Object.keys(RECOVERY_PLANS) : [device];
	const recoverySteps = keys.filter((k) => RECOVERY_PLANS[k]).map((k) => RECOVERY_PLANS[k]);
	return {
		device_filter: device,
		total_recovery_plans: recoverySteps.length,
		recovery_steps: recoverySteps,
		notes: RECOVERY_NOTES
	};
}
