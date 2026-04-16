import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { getRFDatabase } from '$lib/server/db/database';
import { execFileAsync } from '$lib/server/exec';
import type { GlobalProtectConfig, GlobalProtectStatus } from '$lib/types/globalprotect';
import { logger } from '$lib/utils/logger';

import { loadGpConfig, saveGpConfig } from './globalprotect-db';

const OC_BIN = '/usr/sbin/openconnect';
const TUN_DEVICE = 'tun0';
const CONNECT_TIMEOUT_MS = 30_000;
const DISCONNECT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_LINES = 50;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseConnectedIp(
	line: string,
	portal: string,
	current: GlobalProtectStatus
): GlobalProtectStatus {
	const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
	return { status: 'connected', portal, assignedIp: ipMatch?.[1], gateway: current.gateway };
}

function parseGateway(line: string, current: GlobalProtectStatus): GlobalProtectStatus {
	const hostMatch = line.match(/on\s+(\S+)/);
	return { ...current, gateway: hostMatch?.[1] };
}

const OUTPUT_MATCHERS: Array<{
	pattern: string;
	handler: (line: string, portal: string, current: GlobalProtectStatus) => GlobalProtectStatus;
}> = [
	{ pattern: 'connected as', handler: parseConnectedIp },
	{
		pattern: 'esp tunnel connected',
		handler: (_l, p, c) => ({ ...c, status: 'connected', portal: p })
	},
	{ pattern: 'gateway address', handler: (_l, _p, c) => parseGateway(_l, c) },
	{ pattern: 'connected to https on', handler: (_l, _p, c) => parseGateway(_l, c) },
	{
		pattern: 'authentication failed',
		handler: (l, p) => ({ status: 'error', portal: p, lastError: l.trim() })
	},
	{
		pattern: 'failed to',
		handler: (l, p) => ({ status: 'error', portal: p, lastError: l.trim() })
	}
];

function classifyOutputLine(
	line: string,
	portal: string,
	current: GlobalProtectStatus
): GlobalProtectStatus | null {
	const lower = line.toLowerCase();
	const match = OUTPUT_MATCHERS.find((m) => lower.includes(m.pattern));
	return match ? match.handler(line, portal, current) : null;
}

export class GlobalProtectService {
	private static instance: GlobalProtectService;
	private config: GlobalProtectConfig | null = null;
	private ocProcess: ChildProcess | null = null;
	private currentStatus: GlobalProtectStatus = { status: 'disconnected' };
	private outputLines: string[] = [];

	private constructor() {}

	static getInstance(): GlobalProtectService {
		if (!GlobalProtectService.instance) {
			GlobalProtectService.instance = new GlobalProtectService();
		}
		return GlobalProtectService.instance;
	}

	async initialize(): Promise<void> {
		this.loadConfig();
		await this.cleanupOrphanedProcess();
		logger.info('[GlobalProtect] Service initialized (openconnect backend)');
	}

	// -- Config Management --

	loadConfig(): GlobalProtectConfig | null {
		const db = getRFDatabase().rawDb;
		this.config = loadGpConfig(db);
		return this.config;
	}

	getConfig(): GlobalProtectConfig | null {
		return this.config;
	}

	persistConfig(config: Partial<GlobalProtectConfig>): GlobalProtectConfig {
		const current = this.config ?? {
			id: randomUUID(),
			portal: '',
			username: '',
			connectOnStartup: false
		};
		const merged = {
			...current,
			...stripUndefined(config as Record<string, unknown>)
		} as GlobalProtectConfig;
		const db = getRFDatabase().rawDb;
		saveGpConfig(db, merged);
		this.config = merged;
		return merged;
	}

	// -- Connection Management --

	getOutput(): string[] {
		return [...this.outputLines];
	}

	async getStatus(): Promise<GlobalProtectStatus> {
		if (this.ocProcess && !this.ocProcess.killed) {
			return this.currentStatus;
		}
		const externalStatus = await this.probeExternalTun();
		return externalStatus ?? { status: 'disconnected' };
	}

	/** Detect externally-started openconnect (e.g. from terminal) via tun0 interface probe. */
	private async probeExternalTun(): Promise<GlobalProtectStatus | null> {
		try {
			const { stdout } = await execFileAsync('/usr/sbin/ip', [
				'-brief',
				'addr',
				'show',
				TUN_DEVICE
			]);
			const ipMatch = stdout.match(/(\d+\.\d+\.\d+\.\d+)/);
			if (!ipMatch) return null;
			return { status: 'connected', assignedIp: ipMatch[1], portal: this.config?.portal };
		} catch {
			return null;
		}
	}

	async connect(
		portal: string,
		username: string,
		password: string
	): Promise<GlobalProtectStatus> {
		await this.killAllOpenconnect();

		this.currentStatus = { status: 'connecting', portal };
		this.outputLines = [];

		return new Promise<GlobalProtectStatus>((resolve) => {
			const timeout = setTimeout(() => {
				if (this.currentStatus.status === 'connecting') {
					this.currentStatus = {
						status: 'error',
						portal,
						lastError: 'Connection timed out after 30s'
					};
				}
				resolve(this.currentStatus);
			}, CONNECT_TIMEOUT_MS);

			this.spawnOpenconnect(portal, username, password, () => {
				clearTimeout(timeout);
				resolve(this.currentStatus);
			});
		});
	}

	async disconnect(): Promise<GlobalProtectStatus> {
		if (!this.ocProcess || this.ocProcess.killed) {
			this.currentStatus = { status: 'disconnected' };
			return this.currentStatus;
		}

		const proc = this.ocProcess;
		this.ocProcess = null;

		return new Promise<GlobalProtectStatus>((resolve) => {
			const forceKill = setTimeout(() => {
				try {
					proc.kill('SIGKILL');
				} catch {
					/* already dead */
				}
			}, DISCONNECT_TIMEOUT_MS);

			proc.once('exit', () => {
				clearTimeout(forceKill);
				this.currentStatus = { status: 'disconnected' };
				resolve(this.currentStatus);
			});

			try {
				proc.kill('SIGINT');
			} catch {
				/* already dead */
			}
		});
	}

	// -- Process Management --

	private spawnOpenconnect(
		portal: string,
		username: string,
		password: string,
		onSettled: () => void
	): void {
		let settled = false;
		const settle = (): void => {
			if (!settled) {
				settled = true;
				onSettled();
			}
		};

		const proc = spawn(
			'sudo',
			[
				OC_BIN,
				'--protocol=gp',
				`--user=${username}`,
				'--passwd-on-stdin',
				'--verbose',
				portal
			],
			{ stdio: ['pipe', 'pipe', 'pipe'] }
		);

		this.ocProcess = proc;

		proc.stdin?.write(password + '\n');
		proc.stdin?.end();

		const handleLine = (line: string): void => {
			this.addOutputLine(line);
			this.parseOutputLine(line, portal);
			if (
				this.currentStatus.status === 'connected' ||
				this.currentStatus.status === 'error'
			) {
				settle();
			}
		};

		proc.stdout?.on('data', (chunk: Buffer) => {
			for (const line of chunk.toString().split('\n').filter(Boolean)) {
				handleLine(line);
			}
		});

		proc.stderr?.on('data', (chunk: Buffer) => {
			for (const line of chunk.toString().split('\n').filter(Boolean)) {
				handleLine(line);
			}
		});

		proc.on('error', (err) => {
			logger.error(`[GlobalProtect] openconnect spawn error: ${err.message}`);
			this.currentStatus = { status: 'error', portal, lastError: err.message };
			this.ocProcess = null;
			settle();
		});

		proc.on('exit', (code) => {
			logger.info(`[GlobalProtect] openconnect exited with code ${code}`);
			this.ocProcess = null;
			if (this.currentStatus.status !== 'error') {
				this.currentStatus = { status: 'disconnected' };
			}
			settle();
		});
	}

	// -- Output Parsing --

	private parseOutputLine(line: string, portal: string): void {
		const update = classifyOutputLine(line, portal, this.currentStatus);
		if (update) this.currentStatus = update;
	}

	private addOutputLine(line: string): void {
		this.outputLines.push(line);
		if (this.outputLines.length > MAX_OUTPUT_LINES) {
			this.outputLines.shift();
		}
		logger.debug(`[GlobalProtect] ${line}`);
	}

	// -- Cleanup --

	private async killAllOpenconnect(): Promise<void> {
		if (this.ocProcess && !this.ocProcess.killed) {
			this.ocProcess.kill('SIGINT');
			this.ocProcess = null;
		}
		try {
			await execFileAsync('sudo', ['/usr/bin/killall', 'openconnect']);
			logger.info('[GlobalProtect] Killed existing openconnect processes');
		} catch {
			// No openconnect processes running — expected
		}
	}

	private async cleanupOrphanedProcess(): Promise<void> {
		// Only kill the process Argos spawned — never kill externally-started
		// openconnect (e.g. from a terminal). The system-wide killall belongs
		// in connect(), where the user explicitly requests a new connection.
		if (this.ocProcess && !this.ocProcess.killed) {
			this.ocProcess.kill('SIGINT');
			this.ocProcess = null;
			logger.info('[GlobalProtect] Cleaned up Argos-managed openconnect process');
		}
	}
}
