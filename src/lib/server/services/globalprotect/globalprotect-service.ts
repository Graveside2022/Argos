import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { getRFDatabase } from '$lib/server/db/database';
import { execFileAsync } from '$lib/server/exec';
import type { GlobalProtectConfig, GlobalProtectStatus } from '$lib/types/globalprotect';
import { logger } from '$lib/utils/logger';

import { loadGpConfig, saveGpConfig } from './globalprotect-db';

const GP_BIN = '/usr/bin/globalprotect';
const CONNECT_TIMEOUT_MS = 30_000;

const DEFAULT_GP_CONFIG: GlobalProtectConfig = {
	id: '',
	portal: '',
	username: '',
	connectOnStartup: false,
	authMethod: 'password'
};

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseGpStatus(stdout: string): GlobalProtectStatus {
	const lower = stdout.toLowerCase();
	const connected = lower.includes('status: connected');
	const connecting = lower.includes('status: connecting');
	return {
		status: connected ? 'connected' : connecting ? 'connecting' : 'disconnected',
		portal: matchField(stdout, /^portal\s*:\s*(.+)/im),
		gateway: matchField(stdout, /^gateway\s*:\s*(.+)/im),
		assignedIp: matchField(stdout, /^assigned\s*.*:\s*(.+)/im)
	};
}

function matchField(text: string, re: RegExp): string | undefined {
	return re.exec(text)?.[1]?.trim();
}

export class GlobalProtectService {
	private static instance: GlobalProtectService;
	private config: GlobalProtectConfig | null = null;
	private cachedStatus: GlobalProtectStatus = { status: 'disconnected' };

	private constructor() {}

	static getInstance(): GlobalProtectService {
		if (!GlobalProtectService.instance) {
			GlobalProtectService.instance = new GlobalProtectService();
		}
		return GlobalProtectService.instance;
	}

	async initialize(): Promise<void> {
		this.loadConfig();
		logger.info('[GlobalProtect] Service initialized', {
			hasConfig: !!this.config,
			connectOnStartup: this.config?.connectOnStartup ?? false
		});
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
		const base = this.config ?? DEFAULT_GP_CONFIG;
		const merged: GlobalProtectConfig = { ...base, ...stripUndefined(config) };
		if (!merged.id) merged.id = randomUUID();
		const db = getRFDatabase().rawDb;
		saveGpConfig(db, merged);
		this.config = merged;
		return merged;
	}

	// -- Connection Management --

	async getStatus(): Promise<GlobalProtectStatus> {
		try {
			const { stdout } = await execFileAsync(GP_BIN, ['show', '--status'], {
				timeout: 5000
			});
			return this.parseStatusOutput(stdout);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('ENOENT')) {
				return { status: 'error', lastError: 'GlobalProtect CLI not installed' };
			}
			logger.warn('[GlobalProtect] Status check failed', { error: msg });
			return { status: 'disconnected', lastError: msg };
		}
	}

	async connect(
		portal: string,
		username: string,
		password: string
	): Promise<GlobalProtectStatus> {
		this.cachedStatus = { status: 'connecting', portal };
		try {
			const result = await this.spawnWithStdin(
				GP_BIN,
				['connect', '-p', portal, '-u', username],
				password
			);
			logger.info('[GlobalProtect] Connect result', {
				stdout: result.stdout.slice(0, 200)
			});
			const status = await this.getStatus();
			this.cachedStatus = status;
			return status;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error('[GlobalProtect] Connect failed', { error: msg });
			this.cachedStatus = { status: 'error', portal, lastError: msg };
			return this.cachedStatus;
		}
	}

	async disconnect(): Promise<GlobalProtectStatus> {
		try {
			await execFileAsync(GP_BIN, ['disconnect'], { timeout: 10_000 });
			logger.info('[GlobalProtect] Disconnected');
		} catch (err: unknown) {
			logger.warn('[GlobalProtect] Disconnect error', {
				error: err instanceof Error ? err.message : String(err)
			});
		}
		const status = await this.getStatus();
		this.cachedStatus = status;
		return status;
	}

	async importCertificate(certPath: string): Promise<{ success: boolean; message: string }> {
		try {
			const { stdout } = await execFileAsync(
				GP_BIN,
				['import-certificate', '--location', certPath],
				{ timeout: 10_000 }
			);
			logger.info('[GlobalProtect] Certificate imported', { path: certPath });
			return { success: true, message: stdout.trim() || 'Certificate imported' };
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error('[GlobalProtect] Certificate import failed', { error: msg });
			return { success: false, message: msg };
		}
	}

	// -- Output Parsing --

	private parseStatusOutput(stdout: string): GlobalProtectStatus {
		return parseGpStatus(stdout);
	}

	// -- Helpers --

	private spawnWithStdin(
		file: string,
		args: readonly string[],
		stdinData: string
	): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			const proc = spawn(file, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
			let stdout = '';
			let stderr = '';
			const timer = setTimeout(() => {
				proc.kill('SIGTERM');
				reject(new Error(`Command timed out after ${CONNECT_TIMEOUT_MS}ms`));
			}, CONNECT_TIMEOUT_MS);

			proc.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
			});
			proc.stderr.on('data', (data: Buffer) => {
				stderr += data.toString();
			});
			proc.on('close', (code) => {
				clearTimeout(timer);
				if (code === 0) {
					resolve({ stdout, stderr });
				} else {
					reject(new Error(`Exit code ${code}: ${stderr || stdout}`));
				}
			});
			proc.on('error', (err) => {
				clearTimeout(timer);
				reject(err);
			});

			proc.stdin.write(stdinData + '\n');
			proc.stdin.end();
		});
	}
}
