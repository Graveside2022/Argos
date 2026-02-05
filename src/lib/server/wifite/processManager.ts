import { spawn, type ChildProcess, execSync } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type { WifiteResult, WifiteStatus, WifiteConfig, WifiteLastRun, AttackMode } from './types';

const execAsync = promisify(exec);

/**
 * Detect if we're running inside a Docker container.
 * If so, host tools like wifite/aircrack must be called via nsenter.
 */
function isDocker(): boolean {
	try {
		execSync('test -f /.dockerenv', { stdio: 'ignore' });
		return true;
	} catch (_error: unknown) {
		return false;
	}
}

const IN_DOCKER = isDocker();

/** Strip ANSI escape sequences from terminal output. */
function stripAnsi(str: string): string {
	// eslint-disable-next-line no-control-regex
	return str.replace(/\x1B\[[0-9;]*[a-zA-Z]|\x1B\([A-Z]|\r/g, '');
}

/** Wrap a shell command to run in the host mount namespace when inside Docker. */
function hostExec(cmd: string): string {
	if (IN_DOCKER) {
		return `nsenter --target 1 --mount -- sh -c ${JSON.stringify(cmd)}`;
	}
	return cmd;
}

class WifiteProcessManager extends EventEmitter {
	private process: ChildProcess | null = null;
	private running = false;
	private currentTarget: string | null = null;
	private progress = '';
	private results: WifiteResult[] = [];
	private outputLines: string[] = [];
	private kismetWasRunning = false;
	private lastError: string | null = null;
	private lastRun: WifiteLastRun | null = null;
	private runStartedAt: string | null = null;
	private runAttackMode: AttackMode = 'auto';
	private runTargets: string[] = [];

	constructor() {
		super();
		// Prevent unhandled 'error' event crashes — errors are tracked via lastError
		this.on('error', () => {});
	}

	async start(config: WifiteConfig): Promise<{ success: boolean; error?: string }> {
		if (this.running) return { success: false, error: 'Already running' };

		this.lastError = null;
		this.runStartedAt = new Date().toISOString();
		this.runAttackMode = config.attackMode;
		this.runTargets = [...config.targets];
		console.log(
			`[wifite] Starting ${config.attackMode} attack against ${config.targets.length} target(s): ${config.targets.join(', ')}`
		);

		// Check if Kismet is actually running (process check, not just resource manager)
		// Kismet may have been started by a system script outside the resource manager.
		const hwStatus = resourceManager.getStatus();
		let kismetRunning = hwStatus.alfa.owner === 'kismet';
		if (!kismetRunning) {
			try {
				const { stdout } = await execAsync(hostExec('pgrep -x kismet 2>/dev/null')).catch(
					() => ({ stdout: '' })
				);
				kismetRunning = stdout.trim().length > 0;
				if (kismetRunning)
					console.log(
						'[wifite] Kismet detected via process check (not tracked by resource manager)'
					);
			} catch (_error: unknown) {
				// pgrep not found or no match — assume not running
			}
		}

		if (kismetRunning) {
			this.kismetWasRunning = true;
			console.log('[wifite] Stopping Kismet to free ALFA adapter...');
			try {
				await execAsync(hostExec('pkill -x -TERM kismet 2>/dev/null')).catch(() => {});
				await new Promise((r) => setTimeout(r, 3000));
				// Check if still running, force kill
				const { stdout: still } = await execAsync(
					hostExec('pgrep -x kismet 2>/dev/null')
				).catch(() => ({ stdout: '' }));
				if (still.trim()) {
					console.log('[wifite] Kismet still running after SIGTERM, sending SIGKILL...');
					await execAsync(hostExec('pkill -x -9 kismet 2>/dev/null')).catch(() => {});
					await new Promise((r) => setTimeout(r, 2000));
				}
				// Verify Kismet is dead
				const { stdout: verify } = await execAsync(
					hostExec('pgrep -x kismet 2>/dev/null')
				).catch(() => ({ stdout: '' }));
				if (verify.trim()) {
					console.error('[wifite] WARNING: Kismet still running after SIGKILL!');
				} else {
					console.log('[wifite] Kismet process confirmed dead');
				}
			} catch (_error: unknown) {
				// Continue even if stop fails
			}

			// Clean up stale monitor interface left by Kismet.
			// Kismet creates wlan1mon but doesn't always clean it up on exit.
			// Wifite can't scan properly on a stale monitor interface.
			console.log('[wifite] Cleaning up wireless interfaces...');
			try {
				// airmon-ng does driver-specific cleanup (preferred)
				await execAsync(hostExec('airmon-ng stop wlan1mon 2>/dev/null')).catch(() => {});
			} catch (_error: unknown) {
				// Fallback: iw is available in the container with host network namespace
				await execAsync('iw dev wlan1mon del 2>/dev/null').catch(() => {});
			}
			await new Promise((r) => setTimeout(r, 2000));
			console.log('[wifite] Monitor interface cleanup done');

			// Log interface state for debugging
			try {
				const { stdout: ifState } = await execAsync(hostExec('iw dev 2>/dev/null')).catch(
					() => ({ stdout: 'unavailable' })
				);
				console.log(`[wifite] Interface state after cleanup:\n${ifState}`);
			} catch (_error: unknown) {
				/* ignore */
			}

			await resourceManager.forceRelease(HardwareDevice.ALFA);
			console.log('[wifite] Kismet stopped, interfaces cleaned, ALFA released');
		} else {
			this.kismetWasRunning = false;
		}

		const result = await resourceManager.acquire('wifite', HardwareDevice.ALFA);
		if (!result.success) {
			if (this.kismetWasRunning) {
				await this.restartKismet();
			}
			return { success: false, error: `ALFA in use by ${result.owner}` };
		}

		try {
			const wifiteArgs = this.buildArgs(config);
			// Wifite requires a TTY (calls `stty size`). Wrap in `script -qec`
			// to allocate a pseudo-terminal so it doesn't crash.
			const wifiteCmd = `wifite ${wifiteArgs.map((a) => JSON.stringify(a)).join(' ')}`;
			console.log(`[wifite] Command: ${wifiteCmd}`);

			// Pre-flight: log interface state so we can debug scanning issues
			try {
				const { stdout: preFlight } = await execAsync(hostExec('iw dev 2>/dev/null')).catch(
					() => ({ stdout: 'unavailable' })
				);
				console.log(`[wifite] Pre-flight interface state:\n${preFlight}`);
			} catch (_error: unknown) {
				/* ignore */
			}

			if (IN_DOCKER) {
				// Run on host via nsenter, wrapped in script for PTY
				this.process = spawn(
					'nsenter',
					[
						'--target',
						'1',
						'--mount',
						'--uts',
						'--ipc',
						'--pid',
						'--net',
						'--',
						'script',
						'-qec',
						wifiteCmd,
						'/dev/null'
					],
					{
						stdio: ['ignore', 'pipe', 'pipe']
					}
				);
			} else {
				// Run locally, wrapped in script for PTY
				this.process = spawn('script', ['-qec', wifiteCmd, '/dev/null'], {
					stdio: ['ignore', 'pipe', 'pipe']
				});
			}

			this.running = true;
			this.results = [];
			this.outputLines = [];

			this.process.on('error', (err) => {
				console.error(`[wifite] Process error: ${err.message}`);
				this.lastError = err.message;
				this.outputLines.push(`[error] Failed to start wifite: ${err.message}`);
				this.saveLastRun(null);
				this.running = false;
				this.process = null;
				this.currentTarget = null;
				resourceManager.release('wifite', HardwareDevice.ALFA);
				if (this.kismetWasRunning) {
					this.restartKismet();
				}
				this.emit('error', err);
			});

			this.process.stdout?.on('data', (data: Buffer) => {
				const lines = stripAnsi(data.toString())
					.split('\n')
					.filter((l) => l.trim());
				for (const line of lines) {
					console.log(`[wifite:stdout] ${line}`);
					this.outputLines.push(line);
					if (this.outputLines.length > 500) this.outputLines.shift();
					this.parseProgress(line);
					this.emit('output', line);
				}
			});

			this.process.stderr?.on('data', (data: Buffer) => {
				const text = stripAnsi(data.toString()).trim();
				if (text) console.log(`[wifite:stderr] ${text}`);
				this.outputLines.push(text);
				if (this.outputLines.length > 500) this.outputLines.shift();
			});

			this.process.on('exit', async (code) => {
				console.log(
					`[wifite] Process exited with code ${code}. Results: ${this.results.length}, Output lines: ${this.outputLines.length}`
				);
				this.saveLastRun(code);
				this.running = false;
				this.process = null;
				this.currentTarget = null;
				if (code !== 0 && this.outputLines.length === 0) {
					this.lastError = `wifite exited with code ${code}`;
					this.outputLines.push(`[exit] wifite exited with code ${code}`);
				}
				await resourceManager.release('wifite', HardwareDevice.ALFA);
				if (this.kismetWasRunning) {
					await this.restartKismet();
				}
				this.emit('done', this.results);
			});

			return { success: true };
		} catch (error) {
			await resourceManager.release('wifite', HardwareDevice.ALFA);
			this.running = false;
			if (this.kismetWasRunning) {
				await this.restartKismet();
			}
			return { success: false, error: (error as Error).message };
		}
	}

	private buildArgs(config: WifiteConfig): string[] {
		// Specify the ALFA adapter so wifite doesn't prompt for interface selection
		// (stdin is piped to /dev/null, so interactive prompts cause EOFError)
		const iface = process.env.KISMET_INTERFACE || 'wlan1';
		const args = ['-i', iface, '--kill'];

		if (config.attackMode === 'handshake') {
			args.push('--wpa', '--no-pmkid', '--no-wps');
			if (config.timeout) args.push('--wpat', String(config.timeout));
		} else if (config.attackMode === 'pmkid') {
			args.push('--pmkid');
			if (config.timeout) args.push('--pmkid-timeout', String(config.timeout));
		}

		// Add band selection based on target channels
		const channels = config.channels || [];
		const has5ghz = channels.some((ch) => ch > 14);
		const has2ghz = channels.some((ch) => ch >= 1 && ch <= 14);
		if (has5ghz && has2ghz) {
			args.push('--allbands');
		} else if (has5ghz) {
			args.push('-5');
		}
		// Default is 2.4GHz only, no flag needed

		// Expand channels to cover 80 MHz bonded ranges.
		// 5GHz APs use channel bonding (e.g. 80 MHz = 4 channels), so the
		// primary channel may differ from what Kismet reports. Include the
		// full UNII band for any 5GHz channel to ensure wifite finds targets.
		const expandedChannels = new Set<number>();
		for (const ch of channels) {
			if (ch <= 14) {
				// 2.4 GHz: exact channel
				expandedChannels.add(ch);
			} else if (ch >= 36 && ch <= 48) {
				// UNII-1: channels 36, 40, 44, 48
				[36, 40, 44, 48].forEach((c) => expandedChannels.add(c));
			} else if (ch >= 52 && ch <= 64) {
				// UNII-2: channels 52, 56, 60, 64
				[52, 56, 60, 64].forEach((c) => expandedChannels.add(c));
			} else if (ch >= 100 && ch <= 144) {
				// UNII-2e: channels 100-144 (wide range, just add neighbors)
				for (let c = Math.max(100, ch - 12); c <= Math.min(144, ch + 12); c += 4) {
					expandedChannels.add(c);
				}
			} else if (ch >= 149 && ch <= 165) {
				// UNII-3: channels 149, 153, 157, 161, 165
				[149, 153, 157, 161, 165].forEach((c) => expandedChannels.add(c));
			} else {
				expandedChannels.add(ch);
			}
		}
		if (expandedChannels.size > 0) {
			args.push('-c', [...expandedChannels].join(','));
		}

		for (const bssid of config.targets) {
			args.push('-b', bssid);
		}

		return args;
	}

	async stop(): Promise<void> {
		if (this.process) {
			this.process.kill('SIGTERM');
			this.process = null;
		}
		this.running = false;
		this.currentTarget = null;
		await resourceManager.release('wifite', HardwareDevice.ALFA);
		await execAsync(hostExec('pkill -f "wifite" 2>/dev/null')).catch(() => {});

		if (this.kismetWasRunning) {
			await this.restartKismet();
		}
	}

	private async restartKismet(): Promise<void> {
		this.kismetWasRunning = false;
		console.log('[wifite] Restarting Kismet...');
		try {
			const scriptPath = `${process.cwd()}/scripts/start-kismet-with-alfa.sh`;
			await execAsync(scriptPath, { timeout: 30000 });
			console.log('[wifite] Kismet restarted via start script');
		} catch (err) {
			console.log(
				`[wifite] Start script failed: ${(err as Error).message?.slice(0, 100)}, trying direct kismet start...`
			);
			try {
				// Fallback: start kismet directly with the ALFA adapter
				const kismetCmd =
					'nohup kismet -c wlan1:type=linuxwifi --no-ncurses --no-line-wrap > /tmp/kismet.log 2>&1 &';
				if (IN_DOCKER) {
					await execAsync(hostExec(kismetCmd)).catch(() => {});
				} else {
					await execAsync(kismetCmd).catch(() => {});
				}
				console.log('[wifite] Kismet started via direct command');
			} catch (_error: unknown) {
				console.error('[wifite] Failed to restart Kismet');
			}
		}
	}

	private saveLastRun(exitCode: number | null): void {
		this.lastRun = {
			exitCode,
			startedAt: this.runStartedAt || new Date().toISOString(),
			finishedAt: new Date().toISOString(),
			attackMode: this.runAttackMode,
			targets: [...this.runTargets],
			results: [...this.results],
			output: [...this.outputLines]
		};
	}

	private parseProgress(line: string): void {
		// Skip wifite option/config lines — they're not progress
		if (line.includes('option:') || line.includes('Warning:')) return;

		if (line.includes('Attacking')) {
			const match = line.match(/Attacking\s+(\S+)/);
			if (match) this.currentTarget = match[1];
		}

		// Update progress text for handshake/PMKID activity lines
		if (/captured|handshake|pmkid/i.test(line) && !line.includes('option:')) {
			this.progress = line.trim();
		}

		// Wifite prints "Captured handshake" or "saved to <path>" on actual capture
		if (/captured\s+handshake/i.test(line)) {
			const pathMatch = line.match(/saved to (.+)/);
			this.results.push({
				target: this.currentTarget || 'unknown',
				attackType: 'WPA Handshake',
				success: true,
				handshakePath: pathMatch ? pathMatch[1].trim() : null,
				pmkid: null,
				timestamp: new Date().toISOString()
			});
			this.emit('result', this.results[this.results.length - 1]);
		}

		// Wifite prints "Captured PMKID" or "obtained PMKID" on actual capture
		if (/captured\s+pmkid|obtained\s+pmkid/i.test(line)) {
			this.results.push({
				target: this.currentTarget || 'unknown',
				attackType: 'PMKID',
				success: true,
				handshakePath: null,
				pmkid: 'captured',
				timestamp: new Date().toISOString()
			});
			this.emit('result', this.results[this.results.length - 1]);
		}
	}

	getStatus(): WifiteStatus {
		return {
			running: this.running,
			currentTarget: this.currentTarget,
			progress: this.progress,
			results: [...this.results],
			lastRun: this.lastRun
		};
	}

	clearLastRun(): void {
		this.lastRun = null;
	}

	getOutput(): string[] {
		return [...this.outputLines];
	}

	getLastError(): string | null {
		return this.lastError;
	}
}

export const wifiteManager = new WifiteProcessManager();
