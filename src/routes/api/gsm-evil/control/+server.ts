import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, frequency } = (await request.json()) as {
			action: string;
			frequency?: string;
		};

		if (action === 'start') {
			try {
				// Check if USRP is already in use by OpenWebRX or other services
				try {
					const { stdout: usrpStatus } = await execAsync('./scripts/check-usrp-busy.sh');
					if (usrpStatus.trim() !== 'FREE') {
						const busyService = usrpStatus.split(':')[1] || 'Unknown Service';
						return json(
							{
								success: false,
								message: `USRP is currently in use by ${busyService}. Please stop it first before starting GSM Evil.`,
								conflictingService: busyService
							},
							{ status: 409 }
						);
					}
				} catch (busyError) {
					// If script returns non-zero (BUSY), handle the conflict
					const errorOutput = (busyError as { stdout?: string }).stdout || '';
					if (errorOutput.includes('BUSY:')) {
						const busyService = errorOutput.split(':')[1] || 'Unknown Service';
						return json(
							{
								success: false,
								message: `USRP is currently in use by ${busyService}. Please stop it first before starting GSM Evil.`,
								conflictingService: busyService
							},
							{ status: 409 }
						);
					}
				}

				// Check if USRP B205 Mini is connected via USB (more reliable than uhd_find_devices)
				try {
					const { stdout } = await execAsync(
						'lsusb | grep -i "ettus\\|2500:0022" | grep -q "B205" && echo "usrp_found"'
					);
					if (!stdout.includes('usrp_found')) {
						// Fallback: try uhd_find_devices
						const { stdout: uhdOut } = await execAsync(
							'sudo uhd_find_devices 2>&1 | grep -q "B20[05]" && echo "usrp_found"'
						).catch(() => ({ stdout: '' }));
						if (!uhdOut.includes('usrp_found')) {
							throw new Error('USRP not found');
						}
					}
				} catch {
					// Don't block if detection fails - USRP might still work
					console.warn('USRP detection check failed, but continuing anyway...');
				}

				// Use the auto-IMSI script with frequency parameter (default to 947.4 where GSM was detected)
				const freq = frequency || '947.4';
				console.log(`Starting GSM Evil on ${freq} MHz with IMSI sniffer auto-enabled...`);

				// Apply Socket.IO and CORS patches before starting
				console.log('Applying Socket.IO and CORS patches...');
				await execAsync('./scripts/patch-gsmevil-socketio.sh').catch(() => {
					console.warn('Failed to apply patches, continuing anyway...');
				});

				const { stdout, stderr } = await execAsync(
					`sudo ./scripts/gsm-evil-with-auto-imsi.sh ${freq} 45`,
					{
						timeout: 15000 // 15 second timeout
					}
				);

				console.log('Start output:', stdout);
				if (stderr) console.error('Start stderr:', stderr);

				// Verify it started - check for GsmEvil.py or GsmEvil_auto.py (capital G)
				const checkResult = await execAsync('pgrep -f "GsmEvil(_auto)?\\.py"').catch(
					() => ({ stdout: '' })
				);
				if (!checkResult.stdout.trim()) {
					// Also check if port 80 is listening
					const portCheck = await execAsync('sudo lsof -i :80 | grep LISTEN').catch(
						() => ({ stdout: '' })
					);
					if (!portCheck.stdout.trim()) {
						throw new Error(
							'GSM Evil failed to start - no process or port 80 listener found'
						);
					}
				}

				return json({
					success: true,
					message: 'GSM Evil started successfully'
				});
			} catch (error: unknown) {
				console.error('Start error:', error);
				return json(
					{
						success: false,
						message: 'Failed to start GSM Evil',
						error: (error as Error).message
					},
					{ status: 500 }
				);
			}
		} else if (action === 'stop') {
			try {
				console.log('Stopping GSM Evil with bulletproof termination...');

				// Use the enhanced stop script with longer timeout for comprehensive cleanup
				const { stdout, stderr } = await execAsync('./scripts/gsm-evil-stop.sh', {
					timeout: 30000 // 30 second timeout for comprehensive cleanup
				});

				console.log('Stop script output:', stdout);
				if (stderr) console.error('Stop script stderr:', stderr);

				// Verify all processes are actually stopped
				const verifyResult = await execAsync(
					'ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep | wc -l'
				).catch(() => ({ stdout: '0' }));
				const remainingProcesses = parseInt(verifyResult.stdout.trim());

				if (remainingProcesses > 0) {
					// Get details of remaining processes
					const processDetails = await execAsync(
						'ps aux | grep -E "(grgsm_livemon|GsmEvil)" | grep -v grep'
					).catch(() => ({ stdout: 'Unable to get process details' }));
					console.error(
						`Warning: ${remainingProcesses} processes still running:`,
						processDetails.stdout
					);

					return json(
						{
							success: false,
							message: `GSM Evil stop incomplete - ${remainingProcesses} processes still running`,
							warning:
								'Some processes may still be active. Consider manual intervention or system restart.',
							remainingProcesses: processDetails.stdout
						},
						{ status: 206 }
					); // Partial content - partially successful
				}

				// Verify critical ports are freed
				const portChecks = await Promise.all([
					execAsync('lsof -i :80 | grep LISTEN').catch(() => ({ stdout: '' })),
					execAsync('lsof -i :8080 | grep LISTEN').catch(() => ({ stdout: '' })),
					execAsync('lsof -i :4729 | grep LISTEN').catch(() => ({ stdout: '' }))
				]);

				const portsStillInUse = [];
				if (portChecks[0].stdout.trim()) portsStillInUse.push('80');
				if (portChecks[1].stdout.trim()) portsStillInUse.push('8080');
				if (portChecks[2].stdout.trim()) portsStillInUse.push('4729');

				if (portsStillInUse.length > 0) {
					console.warn(`Ports still in use: ${portsStillInUse.join(', ')}`);
					return json({
						success: true,
						message: 'GSM Evil stopped but some ports still in use',
						warning: `Ports ${portsStillInUse.join(', ')} are still occupied`,
						portsInUse: portsStillInUse
					});
				}

				return json({
					success: true,
					message:
						'GSM Evil stopped successfully - all processes terminated and ports freed'
				});
			} catch (error: unknown) {
				console.error('Stop error:', error);

				// Check if it's a timeout error
				if (
					(error as any).signal === 'SIGTERM' ||
					(error as Error).message.includes('timeout')
				) {
					return json(
						{
							success: false,
							message:
								'GSM Evil stop operation timed out - some processes may still be running',
							error: 'Stop script exceeded 30 second timeout',
							suggestion: 'Consider using nuclear stop option or manual intervention'
						},
						{ status: 408 }
					); // Request timeout
				}

				return json(
					{
						success: false,
						message: 'Failed to stop GSM Evil',
						error: (error as Error).message,
						suggestion: 'Check system logs or try nuclear stop option'
					},
					{ status: 500 }
				);
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
		console.error('Control API error:', error);
		return json(
			{
				success: false,
				message: 'Invalid request',
				error: (error as Error).message
			},
			{ status: 400 }
		);
	}
};
