import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { getRFDatabase } from '$lib/server/db/database';
import { execFileAsync } from '$lib/server/exec';
import type { GlobalProtectConfig, GlobalProtectStatus } from '$lib/types/globalprotect';
import { logger } from '$lib/utils/logger';

import { loadGpConfig, saveGpConfig } from './globalprotect-db';

const OC_BIN = '/usr/sbin/openconnect';
const CONNECT_TIMEOUT_MS = 30_000;
const DISCONNECT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_LINES = 50;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function isConnectionSuccess(lower: string): boolean {
	return (
		lower.includes('connected as') ||
		lower.includes('esp tunnel connected') ||
		lower.includes('tunnel connected')
	);
}

function isConnectionError(lower: string): boolean {
	return (
		lower.includes('authentication failed') ||
		lower.includes('failed to') ||
		lower.includes('error:') ||
		lower.includes('fatal:')
	);
}

function classifyOutputLine(
	line: string,
	portal: string,
	current: GlobalProtectStatus
): GlobalProtectStatus | null {
	const lower = line.toLowerCase();

	if (lower.includes('connected as')) {
		const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
		return { status: 'connected', portal, assignedIp: ipMatch?.[1], gateway: current.gateway };
	}
	if (isConnectionSuccess(lower) && current.status !== 'connected') {
		return { ...current, status: 'connected', portal };
	}
	if (lower.includes('gateway address') || lower.includes('connected to https on')) {
		const hostMatch = line.match(/on\s+(\S+)/);
		return { ...current, gateway: hostMatch?.[1] };
	}
	if (isConnectionError(lower)) {
		return { status: 'error', portal, lastError: line.trim() };
	}
	return null;
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
		return { status: 'disconnected' };
	}

	async connect(
		portal: string,
		username: string,
		password: string
	): Promise<GlobalProtectStatus> {
		if (this.ocProcess && !this.ocProcess.killed) {
			return this.currentStatus;
		}

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

	private async cleanupOrphanedProcess(): Promise<void> {
		try {
			await execFileAsync('/sbin/ip', ['link', 'show', 'gpd0']);
			logger.warn('[GlobalProtect] Found orphaned gpd0 interface, cleaning up');
			await execFileAsync('sudo', ['ip', 'link', 'delete', 'gpd0']).catch(() => {});
		} catch {
			// No gpd0 interface — nothing to clean up
		}
	}
}
