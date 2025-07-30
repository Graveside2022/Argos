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
				console.warn('Starting Kismet with unified process management...');

				// Step 1: Check if Kismet is already running and stop if necessary
				try {
					const { stdout: existingPids } = await execAsync('pgrep kismet || echo ""');
					if (existingPids.trim()) {
						console.warn(
							'Existing Kismet processes found, stopping them first:',
							existingPids.trim()
						);
						await execAsync('pkill -TERM kismet');
						await new Promise((resolve) => setTimeout(resolve, 2000));
						await execAsync('pkill -9 kismet 2>/dev/null || true');
					}
				} catch (error) {
					console.warn('Process cleanup had issues (continuing):', error);
				}

				// Step 2: Start Kismet with authentication disabled using config override
				console.warn('Starting Kismet with authentication disabled...');
				const { stdout, stderr } = await execAsync(
					'kismet --no-ncurses --daemonize --override /tmp/kismet_no_auth.conf'
				);
				if (stdout) console.warn('Kismet stdout:', stdout);
				if (stderr) console.warn('Kismet stderr:', stderr);

				// Step 3: Brief wait for startup
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Reduced wait time

				let verificationPassed = false;
				try {
					// Check for process
					const { stdout: newPids } = await execAsync('pgrep kismet || echo ""');
					if (newPids.trim()) {
						console.warn('Kismet process verified:', newPids.trim());
						verificationPassed = true;
					}

					// Additional API verification
					try {
						const { stdout: apiTest } = await execAsync(
							'curl -s -m 5 http://localhost:2501/system/timestamp.json 2>/dev/null || echo ""'
						);
						if (apiTest.includes('timestamp') || apiTest.includes('{')) {
							console.warn('Kismet API responding successfully');
							verificationPassed = true;
						}
					} catch {
						// API not responding yet, process check sufficient
					}
				} catch (error) {
					console.warn('Verification failed:', error);
				}

				if (verificationPassed) {
					return json({
						success: true,
						message: 'Kismet started and verified',
						details: 'Process running and responding'
					});
				} else {
					return json(
						{
							success: false,
							message: 'Kismet start command executed but verification failed',
							error: 'Process may not be running properly'
						},
						{ status: 500 }
					);
				}
			} catch (error: unknown) {
				console.error('Failed to start Kismet:', error);
				const errorMessage = error instanceof Error ? error.message : String(error);
				return json(
					{
						success: false,
						message: 'Failed to start Kismet',
						error: errorMessage
					},
					{ status: 500 }
				);
			}
		} else if (action === 'stop') {
			try {
				console.warn('Stopping Kismet with robust cleanup...');

				// Step 1: Get all Kismet processes with detailed info
				let foundProcesses = false;
				try {
					const { stdout: pids } = await execAsync('pgrep kismet || echo ""');
					if (pids.trim()) {
						foundProcesses = true;
						console.warn('Found Kismet processes to terminate:', pids.trim());

						// Step 2: Graceful termination first
						await execAsync('pkill -TERM kismet');
						console.warn('Sent SIGTERM to Kismet processes');

						// Step 3: Wait for graceful shutdown
						await new Promise((resolve) => setTimeout(resolve, 3000));

						// Step 4: Force kill any remaining processes
						const { stdout: remainingPids } =
							await execAsync('pgrep kismet || echo ""');
						if (remainingPids.trim()) {
							console.warn(
								'Force killing remaining processes:',
								remainingPids.trim()
							);
							await execAsync('pkill -9 kismet');
							await new Promise((resolve) => setTimeout(resolve, 1000));
						}
					} else {
						console.warn('No Kismet processes found');
					}
				} catch (error) {
					console.warn('Process termination had issues:', error);
				}

				// Step 5: Verify processes are actually gone
				let verificationPassed = true;
				try {
					const { stdout: finalCheck } = await execAsync('pgrep kismet || echo ""');
					if (finalCheck.trim()) {
						console.warn(
							'Warning: Some Kismet processes may still be running:',
							finalCheck.trim()
						);
						verificationPassed = false;
					} else {
						console.warn('Verification passed: No Kismet processes found');
					}
				} catch {
					// Assume success if verification fails
				}

				// Step 6: Additional cleanup - check API is no longer responding
				try {
					const { stdout: apiCheck } = await execAsync(
						'curl -s -m 2 http://localhost:2501/system/timestamp.json 2>/dev/null || echo "not_responding"'
					);
					if (apiCheck.includes('timestamp') || apiCheck.includes('{')) {
						console.warn('Warning: Kismet API still responding after stop attempt');
						verificationPassed = false;
					}
				} catch {
					// Expected when API is down
				}

				if (verificationPassed || !foundProcesses) {
					return json({
						success: true,
						message: 'Kismet stopped successfully',
						details: foundProcesses
							? 'Processes terminated and verified'
							: 'No processes were running'
					});
				} else {
					return json(
						{
							success: false,
							message: 'Kismet stop attempted but verification failed',
							error: 'Some processes or services may still be running'
						},
						{ status: 500 }
					);
				}
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

				// Check for manually started Kismet processes with validation
				let hasKismetProcess = false;
				try {
					const { stdout: processOut } = await execAsync(
						'pgrep -f "kismet.*--no-ncurses" || echo ""'
					);
					const pids = processOut.trim();
					if (pids) {
						// Validate that the PID actually exists and is kismet
						const { stdout: psOut } = await execAsync(
							`ps -p ${pids} -o comm= 2>/dev/null || echo ""`
						);
						hasKismetProcess = psOut.includes('kismet');
					}
				} catch {
					hasKismetProcess = false;
				}

				// Double-check by testing if Kismet API is responding
				let apiResponding = false;
				try {
					const { stdout: curlOut } = await execAsync(
						'curl -s -m 2 http://localhost:2501/system/timestamp.json 2>/dev/null || echo ""'
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
