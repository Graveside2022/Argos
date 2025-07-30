import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const { action } = (await request.json()) as {
			action: unknown;
		};

		// Only use mock responses if explicitly requested via ?mock=true
		const useMock = url.searchParams.get('mock') === 'true';

		if (useMock) {
			// Return mock responses only when explicitly requested
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
				// Try to start Kismet service directly
				console.warn('Starting Kismet service...');

				try {
					// First try to start the systemd service
					const { stdout: serviceOut, stderr: serviceErr } = await execAsync(
						'sudo systemctl start kismet-auto-wlan1'
					);
					if (serviceOut) console.warn('Service start output:', serviceOut);
					if (serviceErr) console.error('Service start stderr:', serviceErr);

					return json({
						success: true,
						message: 'Kismet service started',
						details: serviceOut || 'Service started successfully'
					});
				} catch {
					console.warn('Systemd service failed, trying direct kismet command...');

					// If service fails, try to run kismet directly (without sudo)
					try {
						// Start kismet in background without sudo - user permissions should be sufficient
						const { stdout, stderr } = await execAsync(
							'kismet --no-ncurses --daemonize'
						);
						if (stdout) console.warn('Direct kismet output:', stdout);
						if (stderr) console.error('Direct kismet stderr:', stderr);

						// Kismet starts in daemon mode, no need to wait

						return json({
							success: true,
							message: 'Kismet started directly',
							details: 'Kismet process started in background'
						});
					} catch {
						// If both fail, try one more time with the script if it exists locally
						const scriptPath = './scripts/start-kismet-safe.sh';
						try {
							const { stdout: scriptOut, stderr: scriptErr } = await execAsync(
								`sudo ${scriptPath}`
							);
							if (scriptOut) console.warn('Script output:', scriptOut);
							if (scriptErr) console.error('Script stderr:', scriptErr);

							return json({
								success: true,
								message: 'Kismet started via script',
								details: scriptOut
							});
						} catch {
							throw new Error(
								'Failed to start Kismet via service, direct command, or script'
							);
						}
					}
				}
			} catch (error: unknown) {
				console.error('Failed to start Kismet:', error);
				const errorMessage = error instanceof Error ? error.message : String(error);
				return json(
					{
						success: false,
						message: 'Failed to start Kismet',
						error: errorMessage,
						details:
							error instanceof Error && 'stderr' in error
								? (error as Error & { stderr: string }).stderr
								: undefined
					},
					{ status: 500 }
				);
			}
		} else if (action === 'stop') {
			try {
				// First, gracefully stop Kismet process to avoid USB reset
				console.warn('Gracefully stopping Kismet...');

				// Send SIGTERM to Kismet process directly - be specific to avoid killing other processes
				// Only kill the actual kismet binary, not scripts or other processes with kismet in the name
				try {
					// First check if kismet is actually running
					const { stdout: pgrepOut } = await execAsync('pgrep -f "^/usr/bin/kismet"');
					if (pgrepOut.trim()) {
						console.warn('Found kismet process(es):', pgrepOut.trim());
						await execAsync('sudo pkill -TERM -f "^/usr/bin/kismet"');
					} else {
						console.warn('No kismet process found to kill');
					}
				} catch {
					// pgrep returns exit code 1 if no processes found, that's ok
					console.warn('No kismet process found (pgrep returned no results)');
				}

				// Wait a moment for graceful shutdown
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Then stop the systemd service (which should already be stopped)
				try {
					await execAsync('sudo systemctl stop kismet-auto-wlan1');
				} catch {
					// Service might already be stopped, that's ok
				}

				// Clean up any stuck monitor interfaces without resetting USB
				console.warn('Cleaning up monitor interfaces...');
				try {
					const { stdout: cleanupOut } = await execAsync(`
            for iface in wlx*mon kismon*; do
              if ip link show "$iface" >/dev/null 2>&1; then
                echo "Removing interface: $iface"
                sudo ip link delete "$iface" 2>/dev/null || true
              fi
            done
          `);
					if (cleanupOut) console.warn('Cleanup output:', cleanupOut);
				} catch (cleanupError) {
					console.warn(
						'Monitor interface cleanup had issues (non-critical):',
						cleanupError
					);
				}

				return json({
					success: true,
					message: 'Kismet stopped gracefully without network disruption'
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
				// Check for actual Kismet processes instead of systemd service
				// This handles both systemd-managed and manually-started Kismet instances
				try {
					const { stdout: serviceOut } = await execAsync(
						'systemctl is-active kismet-auto-wlan1'
					);
					if (serviceOut.trim() === 'active') {
						return json({
							success: true,
							running: true,
							status: 'active (systemd)'
						});
					}
				} catch {
					// Service doesn't exist or isn't active, check for manual processes
				}

				// Check for manually started Kismet processes
				const { stdout: processOut } = await execAsync(
					'pgrep -f "^kismet.*--no-ncurses" || echo ""'
				);
				const hasKismetProcess = processOut.trim() !== '';

				// Double-check by testing if Kismet API is responding
				let apiResponding = false;
				try {
					const { stdout: curlOut } = await execAsync(
						'curl -s -m 2 http://localhost:2501/system/timestamp.json || echo ""'
					);
					apiResponding = curlOut.includes('timestamp') || curlOut.includes('{');
				} catch {
					// API not responding
				}

				const isRunning = hasKismetProcess || apiResponding;
				return json({
					success: true,
					running: isRunning,
					status: isRunning ? 'active (manual)' : 'inactive'
				});
			} catch {
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
