import { hostExec } from '$lib/server/host-exec';
import { validateInterfaceName, validateNumericParam } from '$lib/server/security/input-sanitizer';

export interface KismetControlResult {
	success: boolean;
	message: string;
	details?: string;
	pid?: number;
	error?: string;
}

export interface KismetStatusResult {
	success: boolean;
	running: boolean;
	status: 'active' | 'inactive';
}

/**
 * Start Kismet WiFi discovery service
 * Detects ALFA adapter, starts Kismet as kali user, sets up auth credentials
 *
 * @returns Result with success status, process details, and any errors
 */
export async function startKismetExtended(): Promise<KismetControlResult> {
	try {
		console.warn('[kismet] Starting Kismet...');

		// Check if Kismet is already running
		const { stdout: existingPids } = await hostExec('pgrep -x kismet 2>/dev/null || true');
		if (existingPids.trim()) {
			console.warn('[kismet] Already running, PID:', existingPids.trim());
			return {
				success: true,
				message: 'Kismet is already running',
				details: `Process ID: ${existingPids.trim()}`
			};
		}

		// Detect ALFA WiFi adapter interface (skip wlan0 = built-in Pi WiFi)
		const { stdout: ifaceList } = await hostExec('ls /sys/class/net/ 2>/dev/null || true');
		let alfaInterface = '';
		for (const iface of ifaceList.trim().split(/\s+/)) {
			if (iface === 'lo' || iface === 'eth0' || iface === 'wlan0' || !iface) continue;
			// Validate interface name before using in shell command
			const validIface = validateInterfaceName(iface);
			// Check if it's a wireless interface
			const { stdout: isWireless } = await hostExec(
				`test -d /sys/class/net/${validIface}/wireless && echo yes || true`
			);
			if (isWireless.trim() === 'yes') {
				alfaInterface = validIface;
				break;
			}
		}

		if (!alfaInterface) {
			console.warn('[kismet] No external WiFi adapter found');
			return {
				success: false,
				message:
					'No external WiFi adapter detected. Connect an ALFA adapter and try again.',
				error: 'No wlan1+ interface found'
			};
		}

		console.warn(`[kismet] Using interface: ${alfaInterface}`);

		// Clean up stale monitor interfaces
		await hostExec(`iw dev ${alfaInterface}mon del 2>/dev/null || true`).catch(
			(error: unknown) => {
				console.warn('[kismet] Cleanup: iw dev mon del failed (non-critical)', {
					error: String(error)
				});
			}
		);

		// Start Kismet as kali user (NOT root) — capture helpers are suid
		// Uses --daemonize so Kismet forks into background properly via nsenter
		// cd to /home/kali so Kismet can write its log database
		await hostExec(
			`sudo -u kali bash -c 'cd /home/kali && kismet -c ${alfaInterface}:type=linuxwifi --no-ncurses --no-line-wrap --daemonize --silent'`,
			{ timeout: 15000 }
		);
		console.warn('[kismet] Start command issued as kali user');

		// Wait for Kismet to initialize (needs time to bind port and set up capture)
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Verify running — retry a few times
		let verifyPid = '';
		for (let attempt = 0; attempt < 3; attempt++) {
			const { stdout: pidCheck } = await hostExec('pgrep -x kismet 2>/dev/null || true');
			if (pidCheck.trim()) {
				verifyPid = pidCheck.trim();
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		if (!verifyPid) {
			return {
				success: false,
				message: 'Kismet failed to start',
				error: 'Process not found after startup. Check if the WiFi adapter is available.'
			};
		}

		// Validate PID before using in shell command
		const validPid = validateNumericParam(parseInt(verifyPid, 10), 'pid', 1, 4194304);

		// Verify running as non-root
		const { stdout: userCheck } = await hostExec(
			`ps -p ${validPid} -o user= 2>/dev/null || true`
		);
		console.warn(`[kismet] Running as user: ${userCheck.trim()}, PID: ${validPid}`);

		// Set up auth credentials if this is a first-time start
		try {
			const kismetUser = process.env.KISMET_USER || 'admin';
			const kismetPass = process.env.KISMET_PASSWORD;
			if (!kismetPass) {
				console.warn('[kismet] KISMET_PASSWORD not set, skipping initial credential setup');
			} else {
				const { stdout: authCheck } = await hostExec(
					`curl -s -m 3 -X POST -d "username=${kismetUser}&password=${kismetPass}" http://localhost:2501/session/set_password 2>/dev/null || true`
				);
				if (authCheck.includes('Login configured')) {
					console.warn('[kismet] Initial credentials set');
				}
			}
		} catch (_error: unknown) {
			// Already configured or not yet ready — either is fine
		}

		return {
			success: true,
			message: 'Kismet started successfully',
			details: `Running as ${userCheck.trim() || 'kali'} (PID: ${validPid}) on ${alfaInterface}`,
			pid: validPid
		};
	} catch (error: unknown) {
		console.error('[kismet] Start error:', error);
		return {
			success: false,
			message: 'Failed to start Kismet',
		// Safe: Error handling
				// Safe: Catch block error cast to Error for message extraction
			error: (error as Error).message
		};
	}
}

/**
 * Stop Kismet WiFi discovery service
 * Stops via systemctl, force kills remaining processes, verifies stopped
 *
 * @returns Result with success status and details
 */
export async function stopKismetExtended(): Promise<KismetControlResult> {
	try {
		console.warn('[kismet] Stopping Kismet...');

		// Check if Kismet is running at all
		const { stdout: pids } = await hostExec('pgrep -x kismet 2>/dev/null || true');
		if (!pids.trim()) {
			// Also ensure systemd service is stopped
			await hostExec('sudo systemctl stop kismet 2>/dev/null || true');
			return {
				success: true,
				message: 'Kismet stopped successfully',
				details: 'No processes were running'
			};
		}

		// Stop via systemctl first (prevents Restart=always from respawning)
		await hostExec('sudo systemctl stop kismet 2>/dev/null || true');
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Force kill any remaining processes not managed by systemd
		const { stdout: remaining } = await hostExec('pgrep -x kismet 2>/dev/null || true');
		if (remaining.trim()) {
			console.warn('[kismet] Processes remain after systemctl stop, force killing...');
			await hostExec('sudo pkill -x -9 kismet 2>/dev/null || true');
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		// Verify stopped
		const { stdout: finalCheck } = await hostExec('pgrep -x kismet 2>/dev/null || true');
		if (finalCheck.trim()) {
			return {
				success: false,
				message: 'Kismet stop attempted but processes remain',
				error: `PIDs still running: ${finalCheck.trim()}`
			};
		}

		console.warn('[kismet] Stopped successfully');
		return {
			success: true,
			message: 'Kismet stopped successfully',
			details: 'Service stopped and processes terminated'
		};
	} catch (error: unknown) {
		return {
			success: false,
			message: 'Failed to stop Kismet',
			error: (error as { message?: string }).message
		};
	}
}

/**
 * Get Kismet service status
 * Checks process and API availability
 *
 * @returns Status with running state
 */
export async function getKismetStatus(): Promise<KismetStatusResult> {
	try {
		const { stdout: processOut } = await hostExec('pgrep -x kismet 2>/dev/null || true');
		const hasProcess = !!processOut.trim();

		// Double-check via API
		let apiResponding = false;
		try {
			const { stdout: apiOut } = await hostExec(
				'curl -s -m 2 http://localhost:2501/system/timestamp.json 2>/dev/null || true'
			);
			apiResponding = apiOut.includes('timestamp') || apiOut.includes('{');
		} catch (_error: unknown) {
			// Not responding
		}

		const isRunning = hasProcess || apiResponding;
		return {
			success: true,
			running: isRunning,
			status: isRunning ? 'active' : 'inactive'
		};
	} catch (_error: unknown) {
		return {
			success: true,
			running: false,
			status: 'inactive'
		};
	}
}
