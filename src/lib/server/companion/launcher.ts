import { spawn, type ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HardwareDevice } from '$lib/server/hardware/types';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import type { CompanionApp, CompanionStatus } from './types';

const execAsync = promisify(exec);

const COMPANION_REGISTRY: Record<string, CompanionApp> = {
	urh: {
		name: 'urh',
		displayName: 'Universal Radio Hacker',
		command: 'urh',
		args: [],
		device: HardwareDevice.HACKRF,
		processPattern: 'urh'
	},
	tempestsdr: {
		name: 'tempestsdr',
		displayName: 'TempestSDR',
		command: 'TempestSDR',
		args: [],
		device: HardwareDevice.HACKRF,
		processPattern: 'TempestSDR'
	}
};

class CompanionLauncherService {
	private processes: Map<string, { process: ChildProcess; startedAt: number }> = new Map();

	getRegistry(): Record<string, CompanionApp> {
		return COMPANION_REGISTRY;
	}

	isValidApp(appName: string): boolean {
		return appName in COMPANION_REGISTRY;
	}

	async launch(appName: string): Promise<CompanionStatus> {
		const app = COMPANION_REGISTRY[appName];
		if (!app) throw new Error(`Unknown companion app: ${appName}`);

		// Check if already running
		const status = await this.getStatus(appName);
		if (status.running) {
			return status;
		}

		// Acquire device
		const result = await resourceManager.acquire(appName, app.device);
		if (!result.success) {
			throw new Error(`${app.device} is in use by ${result.owner}`);
		}

		try {
			// Spawn detached process
			const child = spawn(app.command, app.args, {
				detached: true,
				stdio: 'ignore'
			});

			child.unref();

			child.on('exit', () => {
				this.processes.delete(appName);
				resourceManager.release(appName, app.device);
			});

			const startedAt = Date.now();
			this.processes.set(appName, { process: child, startedAt });

			return {
				running: true,
				pid: child.pid ?? null,
				startedAt,
				appName
			};
		} catch (error) {
			await resourceManager.release(appName, app.device);
			throw error;
		}
	}

	async stop(appName: string): Promise<CompanionStatus> {
		const app = COMPANION_REGISTRY[appName];
		if (!app) throw new Error(`Unknown companion app: ${appName}`);

		// Kill by tracked process
		const tracked = this.processes.get(appName);
		if (tracked?.process.pid) {
			try {
				process.kill(tracked.process.pid);
			} catch {
				// Already dead
			}
		}

		// Also kill by process pattern
		try {
			await execAsync(`pkill -f "${app.processPattern}" 2>/dev/null`);
		} catch {
			// Not found
		}

		this.processes.delete(appName);
		await resourceManager.release(appName, app.device);

		return {
			running: false,
			pid: null,
			startedAt: null,
			appName
		};
	}

	async getStatus(appName: string): Promise<CompanionStatus> {
		const app = COMPANION_REGISTRY[appName];
		if (!app) {
			return { running: false, pid: null, startedAt: null, appName };
		}

		// Check tracked process first
		const tracked = this.processes.get(appName);
		if (tracked?.process.pid) {
			try {
				process.kill(tracked.process.pid, 0); // signal 0 = check if alive
				return {
					running: true,
					pid: tracked.process.pid,
					startedAt: tracked.startedAt,
					appName
				};
			} catch {
				this.processes.delete(appName);
			}
		}

		// Check by pgrep
		try {
			const { stdout } = await execAsync(`pgrep -f "${app.processPattern}" 2>/dev/null`);
			const pid = parseInt(stdout.trim().split('\n')[0]);
			if (pid) {
				return { running: true, pid, startedAt: null, appName };
			}
		} catch {
			// Not running
		}

		return { running: false, pid: null, startedAt: null, appName };
	}
}

export const companionLauncher = new CompanionLauncherService();
