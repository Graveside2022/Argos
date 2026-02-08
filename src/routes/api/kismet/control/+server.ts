import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { hostExec } from '$lib/server/host-exec';

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { action } = (await request.json()) as {
			action: unknown;
		};

		// Only use mock responses if explicitly requested via ?mock=true
		const useMock = url.searchParams.get('mock') === 'true';

		if (useMock) {
			if (action === 'start') {
				return json({
					success: true,
					message: 'Kismet service started (mock mode)',
					details: 'Mock Kismet process started successfully'
				});
			} else if (action === 'stop') {
				return json({
					success: true,
					message: 'Kismet stopped gracefully (mock mode)'
				});
			} else if (action === 'status') {
				return json({
					success: true,
					running: false,
					status: 'inactive'
				});
			}
		}

		if (action === 'start') {
			try {
				console.warn('[kismet] Starting Kismet...');

				// Check if Kismet is already running
				const { stdout: existingPids } = await hostExec(
					'pgrep -x kismet 2>/dev/null || true'
				);
				if (existingPids.trim()) {
					console.warn('[kismet] Already running, PID:', existingPids.trim());
					return json({
						success: true,
						message: 'Kismet is already running',
						details: `Process ID: ${existingPids.trim()}`
					});
				}

				// Detect ALFA WiFi adapter interface (skip wlan0 = built-in Pi WiFi)
				const { stdout: ifaceList } = await hostExec(
					'ls /sys/class/net/ 2>/dev/null || true'
				);
				let alfaInterface = '';
				for (const iface of ifaceList.trim().split(/\s+/)) {
					if (iface === 'lo' || iface === 'eth0' || iface === 'wlan0' || !iface) continue;
					// Check if it's a wireless interface
					const { stdout: isWireless } = await hostExec(
						`test -d /sys/class/net/${iface}/wireless && echo yes || true`
					);
					if (isWireless.trim() === 'yes') {
						alfaInterface = iface;
						break;
					}
				}

				if (!alfaInterface) {
					console.warn('[kismet] No external WiFi adapter found');
					return json(
						{
							success: false,
							message:
								'No external WiFi adapter detected. Connect an ALFA adapter and try again.',
							error: 'No wlan1+ interface found'
						},
						{ status: 400 }
					);
				}

				console.warn(`[kismet] Using interface: ${alfaInterface}`);

				// Clean up stale monitor interfaces
				await hostExec(`iw dev ${alfaInterface}mon del 2>/dev/null || true`).catch(
					() => {}
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
					const { stdout: pidCheck } = await hostExec(
						'pgrep -x kismet 2>/dev/null || true'
					);
					if (pidCheck.trim()) {
						verifyPid = pidCheck.trim();
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}

				if (!verifyPid) {
					return json(
						{
							success: false,
							message: 'Kismet failed to start',
							error: 'Process not found after startup. Check if the WiFi adapter is available.'
						},
						{ status: 500 }
					);
				}

				// Verify running as non-root
				const { stdout: userCheck } = await hostExec(
					`ps -p ${verifyPid} -o user= 2>/dev/null || true`
				);
				console.warn(`[kismet] Running as user: ${userCheck.trim()}, PID: ${verifyPid}`);

				// Set up auth credentials if this is a first-time start
				try {
					const { stdout: authCheck } = await hostExec(
						'curl -s -m 3 -X POST -d "username=admin&password=password" http://localhost:2501/session/set_password 2>/dev/null || true'
					);
					if (authCheck.includes('Login configured')) {
						console.warn('[kismet] Initial credentials set (admin/password)');
					}
				} catch (_error: unknown) {
					// Already configured or not yet ready — either is fine
				}

				return json({
					success: true,
					message: 'Kismet started successfully',
					details: `Running as ${userCheck.trim() || 'kali'} (PID: ${verifyPid}) on ${alfaInterface}`,
					pid: verifyPid
				});
			} catch (error: unknown) {
				console.error('[kismet] Start error:', error);
				return json(
					{
						success: false,
						message: 'Failed to start Kismet',
						error: (error as Error).message
					},
					{ status: 500 }
				);
			}
		} else if (action === 'stop') {
			try {
				console.warn('[kismet] Stopping Kismet...');

				const { stdout: pids } = await hostExec('pgrep -x kismet 2>/dev/null || true');
				if (!pids.trim()) {
					return json({
						success: true,
						message: 'Kismet stopped successfully',
						details: 'No processes were running'
					});
				}

				// Graceful termination
				await hostExec('pkill -x -TERM kismet 2>/dev/null || true').catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 3000));

				// Force kill if still running
				const { stdout: remaining } = await hostExec('pgrep -x kismet 2>/dev/null || true');
				if (remaining.trim()) {
					await hostExec('pkill -x -9 kismet 2>/dev/null || true').catch(() => {});
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}

				// Verify stopped
				const { stdout: finalCheck } = await hostExec(
					'pgrep -x kismet 2>/dev/null || true'
				);
				if (finalCheck.trim()) {
					return json(
						{
							success: false,
							message: 'Kismet stop attempted but processes remain',
							error: `PIDs still running: ${finalCheck.trim()}`
						},
						{ status: 500 }
					);
				}

				console.warn('[kismet] Stopped successfully');
				return json({
					success: true,
					message: 'Kismet stopped successfully',
					details: 'Processes terminated and verified'
				});
			} catch (error: unknown) {
				return json(
					{
						success: false,
						message: 'Failed to stop Kismet',
						error: (error as { message?: string }).message
					},
					{ status: 500 }
				);
			}
		} else if (action === 'status') {
			try {
				const { stdout: processOut } = await hostExec(
					'pgrep -x kismet 2>/dev/null || true'
				);
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
				return json({
					success: true,
					running: isRunning,
					status: isRunning ? 'active' : 'inactive'
				});
			} catch (_error: unknown) {
				return json({
					success: true,
					running: false,
					status: 'inactive'
				});
			}
		} else {
			return json(
				{
					success: false,
					message: 'Invalid action'
				},
				{ status: 400 }
			);
		}
	} catch (error: unknown) {
		return json(
			{
				success: false,
				message: 'Server error',
				error: (error as { message?: string }).message
			},
			{ status: 500 }
		);
	}
};
