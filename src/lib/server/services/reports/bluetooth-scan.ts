/**
 * Bluetooth discovery scan + adapter health probe.
 *
 * Runs `bluetoothctl scan on` for a fixed window, then lists discovered
 * devices and resolves each device's RSSI via `bluetoothctl info <mac>`.
 *
 * Before scanning we probe the adapter state. BlueZ will silently report
 * zero devices when the controller is powered off or rfkill-blocked, so
 * we surface that as a structured reason and optionally attempt a best-
 * effort software power-on before giving up. Uses execFileAsync — never
 * shells out with interpolation.
 */

import { execFileAsync } from '$lib/server/exec';

export interface BluetoothDevice {
	mac: string;
	name: string | null;
	rssi_dbm: number | null;
	first_seen_ms: number;
}

export interface BluetoothAdapterStatus {
	available: boolean;
	powered: boolean;
	address: string | null;
	reason: string | null;
}

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

function isValidMac(mac: string): boolean {
	return MAC_RE.test(mac);
}

function parseDeviceLine(line: string): { mac: string; name: string | null } | null {
	const m = line.match(/^Device\s+([0-9A-Fa-f:]{17})\s*(.*)$/);
	if (!m) return null;
	if (!isValidMac(m[1])) return null;
	const name = (m[2] ?? '').trim() || null;
	return { mac: m[1], name };
}

function parseDevicesOutput(stdout: string): Array<{ mac: string; name: string | null }> {
	const out: Array<{ mac: string; name: string | null }> = [];
	for (const line of stdout.split('\n')) {
		const parsed = parseDeviceLine(line);
		if (parsed) out.push(parsed);
	}
	return out;
}

function parseRssiFromInfo(stdout: string): number | null {
	const m = stdout.match(/RSSI:\s*[^\s]+\s*\((-?\d+)\)/);
	if (m) return parseInt(m[1], 10);
	const m2 = stdout.match(/RSSI:\s*(-?\d+)/);
	return m2 ? parseInt(m2[1], 10) : null;
}

async function runBluetoothctl(args: readonly string[], timeoutMs: number): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/bin/bluetoothctl', args, {
			timeout: timeoutMs,
			maxBuffer: 4 * 1024 * 1024
		});
		return stdout;
	} catch (err) {
		const maybeStdout = (err as { stdout?: string }).stdout;
		return typeof maybeStdout === 'string' ? maybeStdout : '';
	}
}

async function runRfkill(args: readonly string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync('/usr/sbin/rfkill', args, { timeout: 3000 });
		return stdout;
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (code === 'ENOENT') return '';
		const maybeStdout = (err as { stdout?: string }).stdout;
		return typeof maybeStdout === 'string' ? maybeStdout : '';
	}
}

function parseRfkillBlocked(stdout: string): { soft: boolean; hard: boolean } | null {
	if (!stdout) return null;
	const soft = /Soft blocked:\s*yes/i.test(stdout);
	const hard = /Hard blocked:\s*yes/i.test(stdout);
	if (!/bluetooth/i.test(stdout)) return null;
	return { soft, hard };
}

interface BluetoothctlShow {
	powered: boolean;
	address: string | null;
	controllerPresent: boolean;
}

function parseBluetoothctlShow(stdout: string): BluetoothctlShow {
	if (!stdout || /No default controller available/i.test(stdout)) {
		return { powered: false, address: null, controllerPresent: false };
	}
	const powered = /Powered:\s*yes/i.test(stdout);
	const addrMatch = stdout.match(/Controller\s+([0-9A-Fa-f:]{17})/);
	return {
		powered,
		address: addrMatch ? addrMatch[1] : null,
		controllerPresent: true
	};
}

function rfkillReason(rfkill: { soft: boolean; hard: boolean } | null): string | null {
	if (rfkill?.hard) return 'hard-blocked by kill switch';
	if (rfkill?.soft) return 'soft-blocked and power-on failed';
	return null;
}

function pickReason(
	rfkill: { soft: boolean; hard: boolean } | null,
	show: BluetoothctlShow
): string | null {
	if (show.powered) return null;
	if (!show.controllerPresent) return 'no Bluetooth controller present';
	return rfkillReason(rfkill) ?? 'adapter powered down';
}

/**
 * Probe the current Bluetooth adapter state.
 */
export async function checkBluetoothAdapter(): Promise<BluetoothAdapterStatus> {
	const [rfkillOut, showOut] = await Promise.all([
		runRfkill(['list', 'bluetooth']),
		runBluetoothctl(['show'], 3000)
	]);
	const rfkill = parseRfkillBlocked(rfkillOut);
	const show = parseBluetoothctlShow(showOut);
	const available = show.controllerPresent && show.powered;
	return {
		available,
		powered: show.powered,
		address: show.address,
		reason: available ? null : pickReason(rfkill, show)
	};
}

/**
 * Best-effort software recovery: unblock rfkill then ask BlueZ to power on.
 * Returns true if the adapter is powered after the attempt.
 */
export async function tryPowerOnBluetooth(): Promise<boolean> {
	await runRfkill(['unblock', 'bluetooth']);
	await runBluetoothctl(['power', 'on'], 5000);
	const status = await checkBluetoothAdapter();
	return status.powered;
}

async function listDiscoveredDevices(): Promise<Array<{ mac: string; name: string | null }>> {
	const stdout = await runBluetoothctl(['devices'], 5000);
	return parseDevicesOutput(stdout);
}

async function getDeviceRssi(mac: string): Promise<number | null> {
	if (!isValidMac(mac)) return null;
	const stdout = await runBluetoothctl(['info', mac], 4000);
	return parseRssiFromInfo(stdout);
}

/**
 * Run a timed Bluetooth discovery scan. Returns `[]` (not an error) when the
 * adapter is unavailable — callers should surface the `checkBluetoothAdapter`
 * result separately if they need to report the reason.
 *
 * @param durationMs - How long to leave the scan running before collecting results
 */
async function ensureAdapterReady(): Promise<boolean> {
	let status = await checkBluetoothAdapter();
	if (status.available) return true;
	const powered = await tryPowerOnBluetooth();
	if (!powered) return false;
	status = await checkBluetoothAdapter();
	return status.available;
}

async function hydrateDevicesWithRssi(
	discovered: Array<{ mac: string; name: string | null }>,
	firstSeenMs: number
): Promise<BluetoothDevice[]> {
	const results: BluetoothDevice[] = [];
	for (const d of discovered) {
		const rssi = await getDeviceRssi(d.mac);
		results.push({ mac: d.mac, name: d.name, rssi_dbm: rssi, first_seen_ms: firstSeenMs });
	}
	return results;
}

export async function scanBluetooth(durationMs: number): Promise<BluetoothDevice[]> {
	if (!(await ensureAdapterReady())) return [];

	const now = Date.now();
	await runBluetoothctl(
		['--timeout', Math.max(1, Math.floor(durationMs / 1000)).toString(), 'scan', 'on'],
		durationMs + 5000
	);

	const discovered = await listDiscoveredDevices();
	return hydrateDevicesWithRssi(discovered, now);
}
