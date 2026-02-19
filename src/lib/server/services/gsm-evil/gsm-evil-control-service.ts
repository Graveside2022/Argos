import { getGsmEvilDir } from '$lib/server/gsm-database-path';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { legacyShellExec } from '$lib/server/legacy-shell-exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';

export interface GsmEvilStartResult {
	success: boolean;
	message: string;
	error?: string;
	conflictingService?: string;
}

export interface GsmEvilStopResult {
	success: boolean;
	message: string;
	error?: string;
	suggestion?: string;
}

/**
 * Start GSM Evil monitoring with grgsm_livemon_headless and GsmEvil2
 * Acquires HackRF resource, validates frequency, starts daemons, and verifies processes
 *
 * @param frequency Optional frequency in MHz (800-1000, default 947.2)
 * @returns Result with success status and any errors
 */
export async function startGsmEvil(frequency?: string): Promise<GsmEvilStartResult> {
	try {
		// Pre-flight: check that required binaries and directories exist
		const gsmDir = getGsmEvilDir();
		const { stdout: hasGrgsm } = await legacyShellExec(
			'command -v grgsm_livemon_headless >/dev/null 2>&1 && echo ok || echo missing'
		);
		if (hasGrgsm.trim() !== 'ok') {
			return {
				success: false,
				message: 'grgsm_livemon_headless is not installed. Run: sudo apt install gr-gsm'
			};
		}
		const { stdout: hasPython } = await legacyShellExec(
			`test -f ${gsmDir}/GsmEvil.py && echo ok || echo missing`
		);
		if (hasPython.trim() !== 'ok') {
			return {
				success: false,
				message: `GsmEvil2 not found at ${gsmDir}. Run: git clone https://github.com/ninjhacks/gsmevil2.git ${gsmDir}`
			};
		}

		// Acquire HackRF via Resource Manager
		let acquireResult = await resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
		if (!acquireResult.success) {
			// Check if the owning process is actually running — if not, force-release stale lock
			const owner = acquireResult.owner || 'unknown';
			console.warn(`[gsm-evil] HackRF held by "${owner}" — checking if still active...`);
			try {
				const { stdout: gsmProc } = await legacyShellExec(
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
					await legacyShellExec(
						'sudo pkill -f grgsm_livemon_headless 2>/dev/null || true'
					);
					await legacyShellExec('sudo pkill -f "GsmEvil" 2>/dev/null || true');
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
				acquireResult = await resourceManager.acquire('gsm-evil', HardwareDevice.HACKRF);
			}

			if (!acquireResult.success) {
				return {
					success: false,
					message: `HackRF is currently in use by ${acquireResult.owner}. Please stop it first before starting GSM Evil.`,
					conflictingService: acquireResult.owner
				};
			}
		}

		// Validate frequency — prevents shell injection via template literal
		const validatedFreq = validateNumericParam(frequency || '947.2', 'frequency', 800, 1000);
		const freq = String(validatedFreq);
		const gain = '40';
		console.warn(`[gsm-evil] Starting on ${freq} MHz...`);

		// 1. Kill existing processes (ignore errors - may not be running)
		await legacyShellExec('sudo pkill -f grgsm_livemon_headless 2>/dev/null; true').catch(
			(error: unknown) => {
				console.warn('[gsm-evil] Cleanup: pkill grgsm_livemon_headless failed', {
					error: String(error)
				});
			}
		);
		await legacyShellExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch((error: unknown) => {
			console.warn('[gsm-evil] Cleanup: pkill GsmEvil failed', {
				error: String(error)
			});
		});
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// 2. Start grgsm_livemon_headless with proper daemonization (like Kismet)
		// Use setsid + nohup to detach from parent process so dev server restarts don't kill it
		const { stdout: grgsmPid } = await legacyShellExec(
			`sudo setsid nohup grgsm_livemon_headless -f ${freq}M -g ${gain} --collector localhost --collectorport 4729 >/dev/null 2>&1 & echo $!`,
			{ timeout: 5000 }
		);
		console.warn(`[gsm-evil] grgsm started (daemonized), PID: ${grgsmPid.trim()}`);

		// 3. Ensure GsmEvil_auto.py exists with sniffers enabled
		await legacyShellExec(
			`test -f ${gsmDir}/GsmEvil_auto.py || (cp ${gsmDir}/GsmEvil.py ${gsmDir}/GsmEvil_auto.py && sed -i 's/imsi_sniffer = "off"/imsi_sniffer = "on"/' ${gsmDir}/GsmEvil_auto.py && sed -i 's/gsm_sniffer = "off"/gsm_sniffer = "on"/' ${gsmDir}/GsmEvil_auto.py)`
		).catch(() => console.warn('[gsm-evil] GsmEvil_auto.py setup note'));

		// 4. Start GsmEvil2 (needs root for pyshark/tshark capture permissions)
		// Daemonize it so dev server restarts don't kill it
		const { stdout: evilPid } = await legacyShellExec(
			`cd ${gsmDir} && sudo setsid nohup python3 GsmEvil_auto.py --host 0.0.0.0 --port 8080 >/tmp/gsmevil2.log 2>&1 & echo $!`,
			{ timeout: 5000 }
		);
		console.warn(`[gsm-evil] GsmEvil2 started (daemonized), PID: ${evilPid.trim()}`);

		// 5. Wait for processes to initialize
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// 6. Verify both are running
		const { stdout: grgsmCheck } = await legacyShellExec(
			'pgrep -f grgsm_livemon_headless 2>/dev/null; true'
		);
		const { stdout: evilCheck } = await legacyShellExec(
			'pgrep -f "GsmEvil(_auto)?.py" 2>/dev/null; true'
		);

		if (!grgsmCheck.trim()) {
			throw new Error('grgsm_livemon_headless failed to start');
		}
		if (!evilCheck.trim()) {
			const { stdout: logOut } = await legacyShellExec(
				'tail -5 /tmp/gsmevil2.log 2>/dev/null; true'
			);
			throw new Error(`GsmEvil2 failed to start. Log: ${logOut}`);
		}
		console.warn('[gsm-evil] Both processes verified running');

		return {
			success: true,
			message: 'GSM Evil started successfully'
		};
	} catch (error: unknown) {
		console.error('Start error:', error);
		return {
			success: false,
			message: 'Failed to start GSM Evil',
			// Safe: Catch block error from spawn/exec failures cast to Error for message extraction
			error: (error as Error).message
		};
	}
}

/**
 * Stop GSM Evil monitoring (grgsm and GsmEvil processes)
 * ALWAYS releases HackRF resource, even if cleanup is partial (prevents deadlocks)
 *
 * @returns Result with success status, errors, and suggestions
 */
export async function stopGsmEvil(): Promise<GsmEvilStopResult> {
	let stopResult: GsmEvilStopResult;
	try {
		console.warn('[gsm-evil] Stopping GSM Evil...');

		// Kill processes directly (same pattern as working scan endpoint)
		await legacyShellExec('sudo pkill -f grgsm_livemon_headless 2>/dev/null; true').catch(
			(error: unknown) => {
				console.warn('[gsm-evil] Cleanup: pkill grgsm_livemon_headless failed', {
					error: String(error)
				});
			}
		);
		await legacyShellExec('sudo pkill -f GsmEvil 2>/dev/null; true').catch((error: unknown) => {
			console.warn('[gsm-evil] Cleanup: pkill GsmEvil failed', {
				error: String(error)
			});
		});
		await legacyShellExec('sudo fuser -k 8080/tcp 2>/dev/null; true').catch(
			(error: unknown) => {
				console.warn('[gsm-evil] Cleanup: fuser kill port 8080 failed', {
					error: String(error)
				});
			}
		);
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Verify processes are stopped
		const { stdout: remaining } = await legacyShellExec(
			'pgrep -f "grgsm_livemon_headless|GsmEvil" 2>/dev/null; true'
		);

		if (remaining.trim()) {
			// Force kill
			await legacyShellExec(
				'sudo pkill -9 -f grgsm_livemon_headless 2>/dev/null; true'
			).catch((error: unknown) => {
				console.warn('[gsm-evil] Cleanup: pkill -9 grgsm_livemon_headless failed', {
					error: String(error)
				});
			});
			await legacyShellExec('sudo pkill -9 -f GsmEvil 2>/dev/null; true').catch(
				(error: unknown) => {
					console.warn('[gsm-evil] Cleanup: pkill -9 GsmEvil failed', {
						error: String(error)
					});
				}
			);
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		console.warn('[gsm-evil] Processes stopped');
		stopResult = {
			success: true,
			message: 'GSM Evil stopped successfully'
		};
	} catch (error: unknown) {
		console.error('Stop error:', error);

		if (
			// Safe: Error object cast to check for optional signal property (timeout detection)
			(error as { signal?: string }).signal === 'SIGTERM' ||
			// Safe: Error object cast to Error for message string access
			(error as Error).message.includes('timeout')
		) {
			stopResult = {
				success: false,
				message: 'GSM Evil stop operation timed out - some processes may still be running',
				error: 'Stop script exceeded 30 second timeout',
				suggestion: 'Consider using nuclear stop option or manual intervention'
			};
		} else {
			stopResult = {
				success: false,
				message: 'Failed to stop GSM Evil',
				// Safe: Catch block error cast to Error for message extraction in failure response
				error: (error as Error).message,
				suggestion: 'Check system logs or try nuclear stop option'
			};
		}
	} finally {
		// ALWAYS release HackRF — the stop was requested, so release the lock
		// even if cleanup was partial. This prevents deadlocks.
		await resourceManager.release('gsm-evil', HardwareDevice.HACKRF).catch((error: unknown) => {
			console.warn('[gsm-evil] Graceful resource release failed, forcing.', {
				error: String(error)
			});
			// If release fails (e.g., not owner), force-release as last resort
			return resourceManager.forceRelease(HardwareDevice.HACKRF);
		});
	}
	return stopResult;
}
