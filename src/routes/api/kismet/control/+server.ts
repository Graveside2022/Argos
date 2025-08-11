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
				console.warn('Starting Kismet with Alfa adapter...');

				// Step 1: Check if Kismet is already running
				try {
					const { stdout: existingPids } = await execAsync('pgrep -x kismet || echo ""');
					if (existingPids.trim()) {
						console.warn('Kismet is already running with PID:', existingPids.trim());
						return json({
							success: true,
							message: 'Kismet is already running',
							details: `Process ID: ${existingPids.trim()}`
						});
					}
				} catch (error) {
					console.warn('Process check had issues (continuing):', error);
				}

				// Step 2: Use our working startup script
				console.warn('Starting Kismet using startup script...');
				const scriptPath = '/home/ubuntu/projects/Argos/scripts/start-kismet-with-alfa.sh';

				// Execute the script which handles background startup properly
				const { stdout, stderr } = await execAsync(scriptPath);
				console.warn('Script output:', stdout);
				if (stderr && !stderr.includes('nohup')) console.warn('Script stderr:', stderr);

				// Extract PID from script output if available (for debugging)
				const pidMatch = stdout.match(/PID:\s*(\d+)/);
				const _scriptPid = pidMatch ? pidMatch[1] : '';

				// Step 3: Wait for startup and verify
				await new Promise((resolve) => setTimeout(resolve, 3000));

				let verificationPassed = false;
				let kismetPid = '';

				try {
					// Check for process - try multiple times
					for (let attempt = 0; attempt < 3; attempt++) {
						const { stdout: newPids } = await execAsync('pgrep -x kismet || echo ""');
						if (newPids.trim()) {
							kismetPid = newPids.trim();
							console.warn(
								`Kismet process found on attempt ${attempt + 1}:`,
								kismetPid
							);

							// Verify the process is actually alive
							const { stdout: psCheck } = await execAsync(
								`ps -p ${kismetPid} -o comm= 2>/dev/null || echo ""`
							);
							if (psCheck.includes('kismet')) {
								console.warn('Process verified as kismet');
								verificationPassed = true;
								break;
							}
						}
						if (!verificationPassed && attempt < 2) {
							console.warn(`Process not found on attempt ${attempt + 1}, waiting...`);
							await new Promise((resolve) => setTimeout(resolve, 1000));
						}
					}

					// Additional API verification (Kismet may require auth)
					if (!verificationPassed) {
						try {
							const { stdout: apiTest } = await execAsync(
								'curl -s -m 5 http://localhost:2501/ 2>/dev/null | head -5 || echo ""'
							);
							if (apiTest.includes('Kismet') || apiTest.includes('<!DOCTYPE')) {
								console.warn(
									'Kismet web interface responding (no process found though)'
								);
								// Don't set verificationPassed here if no process found
							}
						} catch {
							// API not responding
						}
					}
				} catch (error) {
					console.warn('Verification error:', error);
				}

				if (verificationPassed) {
					return json({
						success: true,
						message: 'Kismet started successfully',
						details: `Process running (PID: ${kismetPid})`,
						pid: kismetPid
					});
				} else {
					// Log why verification failed for debugging
					console.error('Kismet verification failed - PID check:', kismetPid || 'none');
					return json(
						{
							success: false,
							message: 'Kismet start command executed but verification failed',
							error: 'Process may not be running properly',
							debug: `PID: ${kismetPid || 'none found'}`
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
					const { stdout: pids } = await execAsync('pgrep -x kismet || echo ""');
					if (pids.trim()) {
						foundProcesses = true;
						console.warn('Found Kismet processes to terminate:', pids.trim());

						// Step 2: Graceful termination first
						await execAsync('pkill -x -TERM kismet');
						console.warn('Sent SIGTERM to Kismet processes');

						// Step 3: Wait for graceful shutdown
						await new Promise((resolve) => setTimeout(resolve, 3000));

						// Step 4: Force kill any remaining processes
						const { stdout: remainingPids } = await execAsync(
							'pgrep -x kismet || echo ""'
						);
						if (remainingPids.trim()) {
							console.warn(
								'Force killing remaining processes:',
								remainingPids.trim()
							);
							await execAsync('pkill -x -9 kismet');
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
					const { stdout: finalCheck } = await execAsync('pgrep -x kismet || echo ""');
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
					// Use exact match for kismet process
					const { stdout: processOut } = await execAsync('pgrep -x kismet || echo ""');
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
