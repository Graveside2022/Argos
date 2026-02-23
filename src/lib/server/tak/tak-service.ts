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

	/** Calculate uptime in seconds from connection start, or undefined */
	private getUptime(): number | undefined {
		if (!this.connectedAt) return undefined;
		return Math.floor((Date.now() - this.connectedAt) / 1000);
	}

	public getStatus(): TakStatus {
		return {
			status: this.tak?.open ? 'connected' : 'disconnected',
			serverName: this.config?.name,
			serverHost: this.config?.hostname,
			uptime: this.getUptime(),
			messageCount: this.messageCount
		};
	}

	/** Validate that config has TLS certs configured; returns false if not */
	private validateTlsConfig(): boolean {
		if (!this.config) {
			logger.warn('[TakService] No configuration found');
			return false;
		}
		if (!this.config.certPath || !this.config.keyPath) {
			logger.warn('[TakService] TLS certificates not configured');
			return false;
		}
		return true;
	}

	/** Load TLS certificate files from disk */
	private async loadCertificates(): Promise<{ cert: string; key: string; ca?: string } | null> {
		try {
			const cert = await readFile(this.config!.certPath!, 'utf-8');
			const key = await readFile(this.config!.keyPath!, 'utf-8');
			const ca = this.config!.caPath
				? await readFile(this.config!.caPath, 'utf-8')
				: undefined;
			return { cert, key, ca };
		} catch (err) {
			logger.error('[TakService] Failed to load certificates', { error: String(err) });
			this.broadcastStatus(
				'error',
				err instanceof Error ? err.message : 'Certificate load failed'
			);
			return null;
		}
	}

	/** Establish the TAK TLS connection */
	private async establishConnection(certs: {
		cert: string;
		key: string;
		ca?: string;
	}): Promise<void> {
		const url = new URL(`ssl://${this.config!.hostname}:${this.config!.port}`);
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		this.tak = await TAK.connect(url, { ...certs, rejectUnauthorized: false });
		this.setupEventHandlers();
		this.reconnectAttempt = 0;
		logger.info('[TakService] Connection initiated');
	}

	/** Destroy existing TAK connection if any */
	private destroyExisting(): void {
		if (!this.tak) return;
		this.tak.destroy();
		this.tak = null;
	}

	/** Handle a connection failure: log, broadcast, optionally reconnect */
	private handleConnectError(err: unknown): void {
		logger.error('[TakService] Connection failed', { error: String(err) });
		this.broadcastStatus('error', err instanceof Error ? err.message : 'Connection failed');
		if (this.shouldConnect) this.scheduleReconnect();
	}

	public async connect() {
		if (!this.validateTlsConfig()) return;
		this.destroyExisting();

		const certs = await this.loadCertificates();
		if (!certs) return;

		try {
			await this.establishConnection(certs);
		} catch (err) {
			this.handleConnectError(err);
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
			logger.error('[TakService] TAK socket error', { error: err.message });
			// We don't use this.emit('error', err) because Node.js crashes on unhandled 'error' events
			this.emit('tak-socket-error', err);
			this.broadcastStatus('error', err.message);

			this.connectedAt = null;
			if (this.shouldConnect) this.scheduleReconnect();
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

	/** Whether a throttle entry is ready to send (no entry or cooldown elapsed) */
	private isThrottleReady(entry: ThrottleEntry | undefined, now: number): boolean {
		return !entry || now - entry.lastSent >= COT_THROTTLE_MS;
	}

	/** Send immediately and reset throttle entry */
	private sendImmediate(uid: string, cot: CoT, entry: ThrottleEntry | undefined): void {
		if (entry?.pendingTimeout) clearTimeout(entry.pendingTimeout);
		this.throttleMap.set(uid, { lastSent: Date.now(), pendingTimeout: null, pendingCot: null });
		this.tak!.write([cot]);
	}

	/** Schedule a deferred send after the throttle cooldown */
	private scheduleDeferredSend(entry: ThrottleEntry, cot: CoT, now: number): void {
		if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
		entry.pendingCot = cot;
		entry.pendingTimeout = setTimeout(
			() => {
				if (this.tak?.open && entry.pendingCot) {
					this.tak.write([entry.pendingCot]);
					entry.lastSent = Date.now();
					entry.pendingCot = null;
					entry.pendingTimeout = null;
				}
			},
			COT_THROTTLE_MS - (now - entry.lastSent)
		);
	}

	/** Sends a CoT message, throttled to max 1 update/sec per entity UID. */
	public sendCot(cot: CoT) {
		if (!this.tak?.open) return;
		const uid = cot.uid();
		if (!uid) {
			this.tak.write([cot]);
			return;
		}

		const now = Date.now();
		const entry = this.throttleMap.get(uid);
		if (this.isThrottleReady(entry, now)) {
			this.sendImmediate(uid, cot, entry);
		} else {
			this.scheduleDeferredSend(entry!, cot, now);
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
