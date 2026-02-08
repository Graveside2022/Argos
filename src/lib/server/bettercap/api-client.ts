import { exec } from 'child_process';
import { promisify } from 'util';
import type { BettercapSession, BettercapWiFiAP, BettercapBLEDevice } from './types';

const execAsync = promisify(exec);

const API_BASE = 'http://127.0.0.1:8081/api';
const API_USER = process.env.BETTERCAP_USER || 'admin';
function getApiPassword(): string {
	const pass = process.env.BETTERCAP_PASSWORD;
	if (!pass) {
		throw new Error(
			'BETTERCAP_PASSWORD environment variable must be set. See .env.example for configuration.'
		);
	}
	return pass;
}

async function apiRequest(method: string, path: string, body?: string): Promise<unknown> {
	const auth = Buffer.from(`${API_USER}:${getApiPassword()}`).toString('base64');
	const headers: Record<string, string> = {
		Authorization: `Basic ${auth}`,
		'Content-Type': 'application/json'
	};

	try {
		const bodyArg = body ? `-d '${body}'` : '';
		const headerArgs = Object.entries(headers)
			.map(([k, v]) => `-H "${k}: ${v}"`)
			.join(' ');
		const { stdout } = await execAsync(
			`curl -s -X ${method} ${headerArgs} ${bodyArg} "${API_BASE}${path}" 2>/dev/null`,
			{ timeout: 10000 }
		);
		return JSON.parse(stdout);
	} catch (_error: unknown) {
		return null;
	}
}

export async function getSession(): Promise<BettercapSession | null> {
	const data = await apiRequest('GET', '/session');
	return data as BettercapSession | null;
}

export async function runCommand(cmd: string): Promise<unknown> {
	return apiRequest('POST', '/session', JSON.stringify({ cmd }));
}

export async function getWiFiAPs(): Promise<BettercapWiFiAP[]> {
	const data = await runCommand('wifi.show');
	// Bettercap returns structured data for wifi.show
	if (data && typeof data === 'object' && 'aps' in (data as Record<string, unknown>)) {
		return (data as { aps: BettercapWiFiAP[] }).aps || [];
	}
	return [];
}

export async function getBLEDevices(): Promise<BettercapBLEDevice[]> {
	const data = await runCommand('ble.show');
	if (data && typeof data === 'object' && 'devices' in (data as Record<string, unknown>)) {
		return (data as { devices: BettercapBLEDevice[] }).devices || [];
	}
	return [];
}

export async function isContainerRunning(): Promise<boolean> {
	try {
		const { stdout } = await execAsync(
			'docker ps --filter "name=bettercap" --format "{{.Names}}" 2>/dev/null'
		);
		return stdout.trim().length > 0;
	} catch (_error: unknown) {
		return false;
	}
}

export async function startContainer(iface?: string): Promise<void> {
	// Always remove old container — restarting a stale container
	// reuses whatever interface it had (possibly eth0).
	await execAsync('docker stop bettercap 2>/dev/null').catch((error: unknown) => {
		console.warn('[bettercap] Docker: stop bettercap failed', { error: String(error) });
	});
	await execAsync('docker rm -f bettercap 2>/dev/null').catch((error: unknown) => {
		console.warn('[bettercap] Docker: rm -f bettercap failed', { error: String(error) });
	});

	// -iface flag tells bettercap which interface to bind to at startup.
	// Without it, bettercap auto-selects the default route (eth0) and
	// wifi.recon will try to put eth0 into monitor mode, killing the connection.
	const ifaceFlag = iface ? `-iface ${iface}` : '';

	await execAsync(
		[
			'docker run -d',
			'--name bettercap',
			'--network host',
			'--cap-add NET_ADMIN',
			'--cap-add NET_RAW',
			'-e BETTERCAP_API_USER=' + API_USER,
			'-e BETTERCAP_API_PASSWORD=' + getApiPassword(),
			'bettercap/bettercap:latest',
			`bettercap ${ifaceFlag} -api-rest-address 0.0.0.0 -api-rest-port 8081`
		].join(' '),
		{ timeout: 30000 }
	);
}

export async function stopContainer(): Promise<void> {
	await execAsync('docker stop bettercap 2>/dev/null').catch((error: unknown) => {
		console.warn('[bettercap] Docker: stop bettercap failed', { error: String(error) });
	});
}

export async function waitForApi(timeoutMs: number = 15000): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const session = await getSession();
		if (session !== null) return true;
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}
