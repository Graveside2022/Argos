/**
 * Kismet status-checking helpers — process detection, WiFi adapter
 * discovery, and API health probes.
 *
 * Consumed by kismet-control-service-extended.ts (start/stop) and
 * directly by the /api/kismet/control route.
 */

import { readdirSync, statSync } from 'fs';

import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { validateInterfaceName } from '$lib/server/security/input-sanitizer';

export interface KismetStatusResult {
	success: boolean;
	isRunning: boolean;
	status: 'active' | 'inactive';
}

/** Run pgrep -x kismet, returning stdout or empty string if not found. */
export async function pgrepKismet(): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
		return stdout.trim();
	} catch {
		return '';
	}
}

/** Interfaces to skip when scanning for external WiFi adapters */
const SKIP_IFACES = new Set(['lo', 'eth0', 'wlan0', '']);

/** Check if a network interface has wireless capabilities */
function isWirelessAdapter(iface: string): boolean {
	try {
		statSync(`/sys/class/net/${iface}/wireless`);
		return true;
	} catch {
		return false;
	}
}

/** Read network interface names from sysfs */
function listNetworkInterfaces(): string[] {
	try {
		return readdirSync('/sys/class/net/');
	} catch {
		return [];
	}
}

/** Check if an interface is a candidate external wireless adapter */
function isExternalWireless(iface: string): boolean {
	if (SKIP_IFACES.has(iface)) return false;
	return isWirelessAdapter(validateInterfaceName(iface));
}

/** Detect the first external wireless interface */
export function detectWifiAdapter(): string | null {
	const match = listNetworkInterfaces().find(isExternalWireless);
	return match ? validateInterfaceName(match) : null;
}

/** Check if the Kismet HTTP API is responding */
async function isKismetApiResponding(): Promise<boolean> {
	try {
		const response = await fetch(`${env.KISMET_API_URL}/system/timestamp.json`, {
			signal: AbortSignal.timeout(2000)
		});
		const apiOut = await response.text();
		return apiOut.includes('timestamp') || apiOut.includes('{');
	} catch {
		return false;
	}
}

/** Get Kismet service status */
export async function getKismetStatus(): Promise<KismetStatusResult> {
	try {
		const hasProcess = !!(await pgrepKismet());
		const apiResponding = await isKismetApiResponding();
		const isRunning = hasProcess || apiResponding;
		return { success: true, isRunning, status: isRunning ? 'active' : 'inactive' };
	} catch {
		return { success: true, isRunning: false, status: 'inactive' };
	}
}
