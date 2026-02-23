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
				return { isRunning: false };
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
				isRunning: true,
				pid,
				cpu,
				memory,
				uptime: Math.floor(uptime)
			};
		} catch (error) {
			return {
				isRunning: false,
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
			if (status.isRunning) {
				return { success: false, message: 'Kismet is already running' };
			}

			await execFileAsync(this.START_SCRIPT, []);
			await new Promise((resolve) => setTimeout(resolve, 2000));

			const newStatus = await this.getStatus();
			return newStatus.isRunning
				? { success: true, message: 'Kismet started successfully' }
				: { success: false, message: 'Failed to start Kismet' };
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `Failed to start Kismet: ${msg}` };
		}
	}

	/** Kill Kismet processes (TERM then KILL) and clean up monitor interface */
	private static async killKismetProcesses(): Promise<void> {
		await execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet']);
		await new Promise((resolve) => setTimeout(resolve, 3000));
		await execFileAsync('/usr/bin/pkill', ['-KILL', 'kismet']).catch((error: unknown) => {
			logger.warn('[kismet] Cleanup: pkill -KILL kismet failed', { error: String(error) });
		});
		await execFileAsync('/usr/sbin/iw', ['dev', 'kismon0', 'del']).catch((error: unknown) => {
			logger.warn('[kismet] Cleanup: iw dev kismon0 del failed (non-critical)', {
				error: String(error)
			});
		});
	}

	/** Find USB wireless interface names (wlx...) from ip link output */
	private static parseWifiInterfaces(linkOutput: string): string[] {
		return linkOutput
			.split('\n')
			.filter((line) => /wlx[0-9a-f]{12}/.test(line))
			.map((line) => line.match(/:\s+(wlx[0-9a-f]{12})/)?.[1] ?? '')
			.filter(Boolean);
	}

	/** Reset a single USB device by unbinding and rebinding */
	private static async resetUsbDevice(usbLine: string): Promise<void> {
		const busMatch = usbLine.match(/Bus (\d+) Device (\d+)/);
		if (!busMatch) return;
		const [, rawBus, rawDevice] = busMatch;
		const bus = String(validateNumericParam(rawBus, 'USB bus', 1, 999));
		const device = String(validateNumericParam(rawDevice, 'USB device', 1, 999));
		try {
			writeFileSync('/sys/bus/usb/drivers/usb/unbind', `${bus}-${device}`);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			writeFileSync('/sys/bus/usb/drivers/usb/bind', `${bus}-${device}`);
			logger.info('[kismet] Reset USB device', { bus, device });
		} catch (usbResetError) {
			logger.warn('[kismet] Failed to reset USB device', {
				bus,
				device,
				error: String(usbResetError)
			});
		}
	}

	/** Reset a single WiFi interface: down → USB reset → up */
	private static async resetWifiInterface(rawName: string): Promise<void> {
		const interfaceName = validateInterfaceName(rawName);
		logger.info('[kismet] Resetting USB WiFi interface', { interfaceName });

		await execFileAsync('/usr/sbin/ip', ['link', 'set', interfaceName, 'down']);
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const { stdout: lsusbOut } = await execFileAsync('/usr/bin/lsusb', []);
		const usbLines = lsusbOut
			.split('\n')
			.filter((l) => /wireless|wifi|802\.11|network|ethernet/i.test(l));

		for (const usbLine of usbLines) {
			await this.resetUsbDevice(usbLine);
		}

		await new Promise((resolve) => setTimeout(resolve, 2000));
		await execFileAsync('/usr/sbin/ip', ['link', 'set', interfaceName, 'up']);
		logger.info('[kismet] Interface reset complete', { interfaceName });
	}

	/** Reset ALL USB WiFi adapters to fix "stuck in monitor mode" issue */
	private static async resetUsbAdapters(): Promise<void> {
		try {
			const { stdout: linkOutput } = await execFileAsync('/usr/sbin/ip', ['link', 'show']);
			const wifiInterfaces = this.parseWifiInterfaces(linkOutput);
			for (const rawName of wifiInterfaces) {
				try {
					await this.resetWifiInterface(rawName);
				} catch (interfaceError) {
					logger.warn('[kismet] Failed to reset interface', {
						interface: rawName,
						error: String(interfaceError)
					});
				}
			}
		} catch (resetError) {
			logger.warn('[kismet] USB adapter reset failed', { error: String(resetError) });
		}
	}

	/**
	 * Stop the Kismet service with proper USB adapter reset
	 */
	static async stop(): Promise<{ success: boolean; message: string }> {
		try {
			const status = await this.getStatus();
			if (!status.isRunning) {
				return { success: false, message: 'Kismet is not running' };
			}

			await this.killKismetProcesses();
			await this.resetUsbAdapters();

			const newStatus = await this.getStatus();
			return newStatus.isRunning
				? { success: false, message: 'Failed to stop Kismet' }
				: { success: true, message: 'Kismet stopped successfully with adapter reset' };
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, message: `Failed to stop Kismet: ${msg}` };
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
