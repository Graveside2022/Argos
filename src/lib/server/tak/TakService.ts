import type CoT from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';
import TAK from '@tak-ps/node-tak';
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';

import { logger } from '$lib/utils/logger';

import type { TakServerConfig, TakStatus } from '../../types/tak';
import { RFDatabase } from '../db/database';
import { loadTakConfig, saveTakConfig } from './tak-db';

const COT_THROTTLE_MS = 1000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

interface ThrottleEntry {
	lastSent: number;
	pendingTimeout: NodeJS.Timeout | null;
	pendingCot: CoT | null;
}

export class TakService extends EventEmitter {
	private static instance: TakService;
	private tak: TAK | null = null;
	private config: TakServerConfig | null = null;
	private db: RFDatabase;
	private shouldConnect = false;
	private throttleMap = new Map<string, ThrottleEntry>();
	private messageCount = 0;
	private connectedAt: number | null = null;
	private reconnectAttempt = 0;
	private reconnectTimeout: NodeJS.Timeout | null = null;

	private constructor() {
		super();
		this.db = new RFDatabase();
	}

	public static getInstance(): TakService {
		if (!TakService.instance) {
			TakService.instance = new TakService();
		}
		return TakService.instance;
	}

	public async initialize() {
		logger.info('[TakService] Initializing...');
		this.config = loadTakConfig(this.db.rawDb);
		if (this.config?.shouldConnectOnStartup) {
			this.shouldConnect = true;
			await this.connect();
		}
	}

	/** Reload config from DB — call before connect() if config may have changed externally. */
	public reloadConfig() {
		this.config = loadTakConfig(this.db.rawDb);
	}

	public getStatus(): TakStatus {
		return {
			status: this.tak?.open ? 'connected' : 'disconnected',
			serverName: this.config?.name,
			serverHost: this.config?.hostname,
			uptime: this.connectedAt
				? Math.floor((Date.now() - this.connectedAt) / 1000)
				: undefined,
			messageCount: this.messageCount
		};
	}

	public async connect() {
		if (!this.config) {
			logger.warn('[TakService] No configuration found');
			return;
		}
		if (this.tak) {
			this.tak.destroy();
			this.tak = null;
		}
		if (!this.config.certPath || !this.config.keyPath) {
			logger.warn('[TakService] TLS certificates not configured');
			return;
		}

		let cert: string, key: string, ca: string | undefined;
		try {
			cert = await readFile(this.config.certPath, 'utf-8');
			key = await readFile(this.config.keyPath, 'utf-8');
			if (this.config.caPath) ca = await readFile(this.config.caPath, 'utf-8');
		} catch (err) {
			logger.error('[TakService] Failed to load certificates', { error: String(err) });
			this.broadcastStatus(
				'error',
				err instanceof Error ? err.message : 'Certificate load failed'
			);
			return;
		}

		const url = new URL(`ssl://${this.config.hostname}:${this.config.port}`);
		try {
			this.tak = await TAK.connect(url, { cert, key, ca, rejectUnauthorized: true });
			this.setupEventHandlers();
			this.reconnectAttempt = 0;
			logger.info('[TakService] Connection initiated');
		} catch (err) {
			logger.error('[TakService] Connection failed', { error: String(err) });
			this.broadcastStatus('error', err instanceof Error ? err.message : 'Connection failed');
			if (this.shouldConnect) this.scheduleReconnect();
		}
	}

	private setupEventHandlers() {
		if (!this.tak) return;

		this.tak.on('secureConnect', () => {
			logger.info('[TakService] Securely connected');
			this.connectedAt = Date.now();
			this.emit('status', 'connected');
			this.broadcastStatus('connected');
		});

		this.tak.on('cot', (cot: CoT) => {
			this.messageCount++;
			this.emit('cot', cot);
			this.broadcastCot(CoTParser.to_xml(cot));
		});

		this.tak.on('end', () => {
			logger.info('[TakService] Connection ended');
			this.connectedAt = null;
			this.emit('status', 'disconnected');
			this.broadcastStatus('disconnected');
			if (this.shouldConnect) this.scheduleReconnect();
		});

		this.tak.on('timeout', () => logger.warn('[TakService] Connection timeout'));

		this.tak.on('error', (err: Error) => {
			logger.error('[TakService] Error', { error: err.message });
			this.emit('error', err);
			this.broadcastStatus('error', err.message);
		});

		this.tak.on('ping', () => {
			if (!this.connectedAt) this.connectedAt = Date.now();
		});
	}

	private scheduleReconnect() {
		if (this.reconnectTimeout) return;
		const expDelay = RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt);
		const jitter = Math.random() * RECONNECT_BASE_MS;
		const delay = Math.min(expDelay + jitter, RECONNECT_MAX_MS);
		this.reconnectAttempt++;
		logger.info('[TakService] Reconnecting', {
			delayMs: Math.round(delay),
			attempt: this.reconnectAttempt
		});
		this.reconnectTimeout = setTimeout(async () => {
			this.reconnectTimeout = null;
			try {
				await this.connect();
			} catch (err) {
				logger.error('[TakService] Reconnect failed', { error: String(err) });
			}
		}, delay);
	}

	public disconnect() {
		this.shouldConnect = false;
		if (this.tak) {
			this.tak.destroy();
			this.tak = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		for (const entry of this.throttleMap.values()) {
			if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
		}
		this.throttleMap.clear();
		this.connectedAt = null;
		this.emit('status', 'disconnected');
		this.broadcastStatus('disconnected');
	}

	/** Sends a CoT message, throttled to max 1 update/sec per entity UID. */
	public sendCot(cot: CoT) {
		if (!this.tak || !this.tak.open) return;
		const uid = cot.uid();
		if (!uid) {
			this.tak.write([cot]);
			return;
		}

		const now = Date.now();
		const entry = this.throttleMap.get(uid);
		if (!entry || now - entry.lastSent >= COT_THROTTLE_MS) {
			if (entry?.pendingTimeout) clearTimeout(entry.pendingTimeout);
			this.throttleMap.set(uid, { lastSent: now, pendingTimeout: null, pendingCot: null });
			this.tak.write([cot]);
		} else {
			if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
			const delay = COT_THROTTLE_MS - (now - entry.lastSent);
			entry.pendingCot = cot;
			entry.pendingTimeout = setTimeout(() => {
				if (this.tak?.open && entry.pendingCot) {
					this.tak.write([entry.pendingCot]);
					entry.lastSent = Date.now();
					entry.pendingCot = null;
					entry.pendingTimeout = null;
				}
			}, delay);
		}
	}

	public async saveConfig(config: TakServerConfig) {
		saveTakConfig(this.db.rawDb, config);
		this.config = config;
		if (this.shouldConnect) await this.connect();
	}

	private broadcastStatus(status: TakStatus['status'], lastError?: string) {
		import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
			WebSocketManager.getInstance().broadcast({
				type: 'tak_status',
				data: {
					status,
					serverName: this.config?.name,
					serverHost: this.config?.hostname,
					uptime: this.connectedAt
						? Math.floor((Date.now() - this.connectedAt) / 1000)
						: undefined,
					messageCount: this.messageCount,
					lastError
				},
				timestamp: new Date().toISOString()
			});
		});
	}

	private broadcastCot(xml: string) {
		import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
			WebSocketManager.getInstance().broadcast({
				type: 'tak_cot',
				data: { xml },
				timestamp: new Date().toISOString()
			});
		});
	}
}
