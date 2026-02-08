import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { hostExec } from '$lib/server/host-exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, frequency } = (await request.json()) as {
			action: string;
			frequency?: string;
		};

		if (action === 'start') {
			try {
				// Acquire HackRF via Resource Manager
				let acquireResult = await resourceManager.acquire(
					'gsm-evil',
					HardwareDevice.HACKRF
				);
				if (!acquireResult.success) {
					// Check if the owning process is actually running — if not, force-release stale lock
					const owner = acquireResult.owner || 'unknown';
					console.warn(
						`[gsm-evil] HackRF held by "${owner}" — checking if still active...`
					);
					try {
						const { stdout: gsmProc } = await hostExec(
							'pgrep -f "grgsm_livemon|GsmEvil" 2>/dev/null || true'
						);
						if (!gsmProc.trim()) {
							console.warn(
								`[gsm-evil] No active GSM process found — releasing stale "${owner}" lock`
							);
							await resourceManager.forceRelease(HardwareDevice.HACKRF);
							acquireResult = await resourceManager.acquire(
								'gsm-evil',
								HardwareDevice.HACKRF
							);
						} else {
							// Active processes — kill them first
							console.warn(
								'[gsm-evil] Found running GSM processes — killing them to free HackRF...'
							);
							await hostExec(
								'sudo pkill -f grgsm_livemon_headless 2>/dev/null || true'
							);
							await hostExec('sudo pkill -f "GsmEvil" 2>/dev/null || true');
							await new Promise((resolve) => setTimeout(resolve, 1000));
							await resourceManager.forceRelease(HardwareDevice.HACKRF);
							acquireResult = await resourceManager.acquire(
								'gsm-evil',
								HardwareDevice.HACKRF
							);
						}
					} catch (_error: unknown) {
						console.warn('[gsm-evil] Process check failed — forcing resource release');
						await resourceManager.forceRelease(HardwareDevice.HACKRF);
						acquireResult = await resourceManager.acquire(
							'gsm-evil',
							HardwareDevice.HACKRF
						);
					}

					if (!acquireResult.success) {
						return json(
							{
								success: false,
								message: `HackRF is currently in use by ${acquireResult.owner}. Please stop it first before starting GSM Evil.`,
								conflictingService: acquireResult.owner
							},
							{ status: 409 }
						);
					}
				}

				// Validate frequency — prevents shell injection via hostExec template literal
				const validatedFreq = validateNumericParam(
					frequency || '947.2',
					'frequency',
					800,
					1000
				);
				const freq = String(validatedFreq);
				const gain = '40';
				const gsmDir = '/home/kali/gsmevil-user';
				console.warn(`[gsm-evil] Starting on ${freq} MHz...`);

				// 1. Kill existing processes (ignore errors - may not be running)
				await hostExec('sudo pkill -f grgsm_livemon_headless 2>/dev/null; true').catch(
					() => {}
				);
				await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// 2. Start grgsm_livemon_headless (same pattern as working scan endpoint)
				const { stdout: grgsmPid } = await hostExec(
					`sudo grgsm_livemon_headless -f ${freq}M -g ${gain} --collector localhost --collectorport 4729 >/dev/null 2>&1 & echo $!`,
					{ timeout: 5000 }
				);
				console.warn(`[gsm-evil] grgsm started, PID: ${grgsmPid.trim()}`);

				// 3. Ensure GsmEvil_auto.py exists with sniffers enabled
				await hostExec(
					`test -f ${gsmDir}/GsmEvil_auto.py || (cp ${gsmDir}/GsmEvil.py ${gsmDir}/GsmEvil_auto.py && sed -i 's/imsi_sniffer = "off"/imsi_sniffer = "on"/' ${gsmDir}/GsmEvil_auto.py && sed -i 's/gsm_sniffer = "off"/gsm_sniffer = "on"/' ${gsmDir}/GsmEvil_auto.py)`
				).catch(() => console.warn('[gsm-evil] GsmEvil_auto.py setup note'));

				// 4. Start GsmEvil2 (needs root for pyshark/tshark capture permissions)
				const { stdout: evilPid } = await hostExec(
					`cd ${gsmDir} && sudo python3 GsmEvil_auto.py --host 0.0.0.0 --port 8080 >/tmp/gsmevil2.log 2>&1 & echo $!`,
					{ timeout: 5000 }
				);
				console.warn(`[gsm-evil] GsmEvil2 started, PID: ${evilPid.trim()}`);

				// 5. Wait for processes to initialize
				await new Promise((resolve) => setTimeout(resolve, 3000));

				// 6. Verify both are running
				const { stdout: grgsmCheck } = await hostExec(
					'pgrep -f grgsm_livemon_headless 2>/dev/null; true'
				);
				const { stdout: evilCheck } = await hostExec(
					'pgrep -f "GsmEvil(_auto)?.py" 2>/dev/null; true'
				);

				if (!grgsmCheck.trim()) {
					throw new Error('grgsm_livemon_headless failed to start');
				}
				if (!evilCheck.trim()) {
					const { stdout: logOut } = await hostExec(
						'tail -5 /tmp/gsmevil2.log 2>/dev/null; true'
					);
					throw new Error(`GsmEvil2 failed to start. Log: ${logOut}`);
				}
				console.warn('[gsm-evil] Both processes verified running');

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
			// ALWAYS release the HackRF resource when stopping, regardless of cleanup outcome.
			// Previous bug: resource was only released in the perfect happy path, causing deadlocks.
			let stopResult: Response | null = null;
			try {
				console.warn('[gsm-evil] Stopping GSM Evil...');

				// Kill processes directly (same pattern as working scan endpoint)
				await hostExec('sudo pkill -f grgsm_livemon_headless 2>/dev/null; true').catch(
					() => {}
				);
				await hostExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch(() => {});
				await hostExec('sudo fuser -k 8080/tcp 2>/dev/null; true').catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Verify processes are stopped
				const { stdout: remaining } = await hostExec(
					'pgrep -f "grgsm_livemon_headless|GsmEvil" 2>/dev/null; true'
				);

				if (remaining.trim()) {
					// Force kill
					await hostExec(
						'sudo pkill -9 -f grgsm_livemon_headless 2>/dev/null; true'
					).catch(() => {});
					await hostExec('sudo pkill -9 -f GsmEvil 2>/dev/null; true').catch(() => {});
					await new Promise((resolve) => setTimeout(resolve, 500));
				}

				console.warn('[gsm-evil] Processes stopped');
				stopResult = json({
					success: true,
					message: 'GSM Evil stopped successfully'
				});
			} catch (error: unknown) {
				console.error('Stop error:', error);

				if (
					(error as { signal?: string }).signal === 'SIGTERM' ||
					(error as Error).message.includes('timeout')
				) {
					stopResult = json(
						{
							success: false,
							message:
								'GSM Evil stop operation timed out - some processes may still be running',
							error: 'Stop script exceeded 30 second timeout',
							suggestion: 'Consider using nuclear stop option or manual intervention'
						},
						{ status: 408 }
					);
				} else {
					stopResult = json(
						{
							success: false,
							message: 'Failed to stop GSM Evil',
							error: (error as Error).message,
							suggestion: 'Check system logs or try nuclear stop option'
						},
						{ status: 500 }
					);
				}
			} finally {
				// ALWAYS release HackRF — the stop was requested, so release the lock
				// even if cleanup was partial. This prevents deadlocks.
				await resourceManager.release('gsm-evil', HardwareDevice.HACKRF).catch(() => {
					// If release fails (e.g., not owner), force-release as last resort
					return resourceManager.forceRelease(HardwareDevice.HACKRF);
				});
			}
			return stopResult!;
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
