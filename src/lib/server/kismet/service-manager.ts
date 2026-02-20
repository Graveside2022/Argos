// Kismet service management
import { execFile } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { validateInterfaceName, validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

import type { KismetServiceStatus } from './types';

const execFileAsync = promisify(execFile);

export class KismetServiceManager {
	private static readonly SERVICE_NAME = 'kismet';
	private static readonly START_SCRIPT = path.join(process.cwd(), 'scripts/start_kismet.sh');
	private static readonly PID_FILE = '/tmp/argos-kismet.pid';
	private static readonly LOG_FILE = '/tmp/argos-kismet.log';

	/**
	 * Get the current status of the Kismet service
	 */
	static async getStatus(): Promise<KismetServiceStatus> {
		try {
			// Check if Kismet is running using pgrep
			const { stdout: pgrepOutput } = await execFileAsync('/usr/bin/pgrep', ['-f', 'kismet']);
			const pids = pgrepOutput.trim().split('\n').filter(Boolean);

			if (pids.length === 0) {
				return { running: false };
			}

			const pid = parseInt(pids[0]);

			// Get process info
			const { stdout: psOutput } = await execFileAsync('/usr/bin/ps', [
				'-p',
				String(pid),
				'-o',
				'%cpu,%mem,etimes',
				'--no-headers'
			]);
			const [cpu, memory, uptime] = psOutput.trim().split(/\s+/).map(parseFloat);

			return {
				running: true,
				pid,
				cpu,
				memory,
				uptime: Math.floor(uptime)
			};
		} catch (error) {
			return {
				running: false,
				// Safe: Error handling
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Start the Kismet service
	 */
	static async start(): Promise<{ success: boolean; message: string }> {
		try {
			const status = await this.getStatus();
			if (status.running) {
				return { success: false, message: 'Kismet is already running' };
			}

			// Execute the start script
			await execFileAsync(this.START_SCRIPT, []);

			// Wait a moment for the service to start
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Verify it started
			const newStatus = await this.getStatus();
			if (newStatus.running) {
				return { success: true, message: 'Kismet started successfully' };
			} else {
				return { success: false, message: 'Failed to start Kismet' };
			}
		} catch (error) {
			return {
				success: false,
				// Safe: Error handling
				message: `Failed to start Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Stop the Kismet service with proper USB adapter reset
	 */
	static async stop(): Promise<{ success: boolean; message: string }> {
		try {
			const status = await this.getStatus();
			if (!status.running) {
				return { success: false, message: 'Kismet is not running' };
			}

			// Kill the Kismet process cleanly
			await execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet']);
			await new Promise((resolve) => setTimeout(resolve, 3000));
			await execFileAsync('/usr/bin/pkill', ['-KILL', 'kismet']).catch((error: unknown) => {
				logger.warn('[kismet] Cleanup: pkill -KILL kismet failed', {
					error: String(error)
				});
			}); // Force kill if needed

			// Remove monitor interface if it exists
			await execFileAsync('/usr/sbin/iw', ['dev', 'kismon0', 'del']).catch(
				(error: unknown) => {
					logger.warn('[kismet] Cleanup: iw dev kismon0 del failed (non-critical)', {
						error: String(error)
					});
				}
			); // Ignore errors if interface doesn't exist

			// Reset ALL USB WiFi adapters to fix "stuck in monitor mode" issue
			try {
				// Find all USB wireless interfaces (typically start with wlx)
				const { stdout: linkOutput } = await execFileAsync('/usr/sbin/ip', [
					'link',
					'show'
				]);
				const wifiInterfaces = linkOutput
					.split('\n')
					.filter((line) => /wlx[0-9a-f]{12}/.test(line))
					.map((line) => {
						const match = line.match(/:\s+(wlx[0-9a-f]{12})/);
						return match ? match[1] : '';
					})
					.filter(Boolean);

				for (const rawName of wifiInterfaces) {
					try {
						const interfaceName = validateInterfaceName(rawName);
						logger.info('[kismet] Resetting USB WiFi interface', { interfaceName });

						// Bring interface down
						await execFileAsync('/usr/sbin/ip', ['link', 'set', interfaceName, 'down']);
						await new Promise((resolve) => setTimeout(resolve, 1000));

						// Get interface MAC to find corresponding USB device
						const { stdout: linkInfo } = await execFileAsync('/usr/sbin/ip', [
							'link',
							'show',
							interfaceName
						]);
						const macMatch = linkInfo.match(/([0-9a-f]{2}:){5}[0-9a-f]{2}/i);
						const macAddr = macMatch ? macMatch[0] : '';

						if (macAddr) {
							// Find USB device by searching for wireless interfaces
							const { stdout: lsusbOut } = await execFileAsync('/usr/bin/lsusb', []);
							const usbLines = lsusbOut
								.split('\n')
								.filter((l) => /wireless|wifi|802\.11|network|ethernet/i.test(l));

							if (usbLines.length > 0) {
								// Try to find and reset each potential wireless USB device
								for (const usbLine of usbLines) {
									const busMatch = usbLine.match(/Bus (\d+) Device (\d+)/);
									if (busMatch) {
										const [, rawBus, rawDevice] = busMatch;
										const bus = String(
											validateNumericParam(rawBus, 'USB bus', 1, 999)
										);
										const device = String(
											validateNumericParam(rawDevice, 'USB device', 1, 999)
										);
										try {
											// Unbind and rebind USB device to reset its state
											writeFileSync(
												'/sys/bus/usb/drivers/usb/unbind',
												`${bus}-${device}`
											);
											await new Promise((resolve) =>
												setTimeout(resolve, 1000)
											);
											writeFileSync(
												'/sys/bus/usb/drivers/usb/bind',
												`${bus}-${device}`
											);
											logger.info('[kismet] Reset USB device', {
												bus,
												device
											});
										} catch (usbResetError) {
											logger.warn('[kismet] Failed to reset USB device', {
												bus,
												device,
												error: String(usbResetError)
											});
										}
									}
								}
							}
						}

						// Wait for device to reinitialize
						await new Promise((resolve) => setTimeout(resolve, 2000));

						// Bring interface back up
						await execFileAsync('/usr/sbin/ip', ['link', 'set', interfaceName, 'up']);
						logger.info('[kismet] Interface reset complete', { interfaceName });
					} catch (interfaceError) {
						logger.warn('[kismet] Failed to reset interface', {
							interface: rawName,
							error: String(interfaceError)
						});
					}
				}
			} catch (resetError) {
				logger.warn('[kismet] USB adapter reset failed', { error: String(resetError) });
				// Continue anyway - basic stop still worked
			}

			// Verify it stopped
			const newStatus = await this.getStatus();
			if (!newStatus.running) {
				return { success: true, message: 'Kismet stopped successfully with adapter reset' };
			} else {
				return { success: false, message: 'Failed to stop Kismet' };
			}
		} catch (error) {
			return {
				success: false,
				// Safe: Error handling
				message: `Failed to stop Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Restart the Kismet service
	 */
	static async restart(): Promise<{ success: boolean; message: string }> {
		try {
			const stopResult = await this.stop();
			if (stopResult.success || stopResult.message === 'Kismet is not running') {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return await this.start();
			} else {
				return stopResult;
			}
		} catch (error) {
			return {
				success: false,
				// Safe: Error handling
				message: `Failed to restart Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}

	/**
	 * Get recent log entries
	 */
	static async getLogs(lines: number = 100): Promise<string[]> {
		try {
			const { readFileSync } = await import('fs');
			const content = readFileSync(this.LOG_FILE, 'utf-8');
			return content.trim().split('\n').filter(Boolean).slice(-lines);
		} catch (error) {
			return [
				// Safe: Error handling
				`Error reading logs: ${error instanceof Error ? error.message : 'Unknown error'}`
			];
		}
	}
}
