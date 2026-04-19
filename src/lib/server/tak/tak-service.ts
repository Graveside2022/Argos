import type CoT from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';
import TAK from '@tak-ps/node-tak';
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';

import { logger } from '$lib/utils/logger';

import type { TakServerConfig, TakStatus } from '../../types/tak';
import { RFDatabase } from '../db/database';
import { broadcastTakCot, broadcastTakStatus } from './tak-broadcast';
import { loadTakConfig, saveTakConfig } from './tak-db';
import { TakSaBroadcaster } from './tak-sa-broadcaster';

const COT_THROTTLE_MS = 1000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const STALE_THRESHOLD_MS = 120_000;

/**
 * TakServerConfig with the optional cert/key paths proven non-empty.
 * Returned by `validateTlsConfig` so downstream methods don't need `!`.
 */
type ValidatedTakConfig = TakServerConfig & { certPath: string; keyPath: string };

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
	private lastActivityAt: number | null = null;
	private reconnectAttempt = 0;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private saBroadcaster: TakSaBroadcaster;

	private constructor() {
		super();
		this.db = new RFDatabase();
		this.saBroadcaster = new TakSaBroadcaster(this);
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

	/** Derive connection health from activity timestamp */
	private getConnectionHealth(
		isOpen: boolean
	): Pick<TakStatus, 'lastActivityAt' | 'staleSinceMs' | 'connectionHealth'> {
		if (!isOpen)
			return { lastActivityAt: null, staleSinceMs: null, connectionHealth: 'disconnected' };
		if (!this.lastActivityAt)
			return { lastActivityAt: null, staleSinceMs: null, connectionHealth: 'healthy' };
		const staleMs = Date.now() - this.lastActivityAt;
		const iso = new Date(this.lastActivityAt).toISOString();
		return {
			lastActivityAt: iso,
			staleSinceMs: staleMs,
			connectionHealth: staleMs > STALE_THRESHOLD_MS ? 'stale' : 'healthy'
		};
	}

	public getStatus(): TakStatus {
		const isOpen = !!this.tak?.open;
		return {
			status: isOpen ? 'connected' : 'disconnected',
			serverName: this.config?.name,
			serverHost: this.config?.hostname,
			uptime: this.getUptime(),
			messageCount: this.messageCount,
			...this.getConnectionHealth(isOpen),
			saBroadcast: this.saBroadcaster.getStatus()
		};
	}

	/** Validate that config has TLS certs configured; returns the narrowed config or null. */
	private validateTlsConfig(): ValidatedTakConfig | null {
		const cfg = this.config;
		if (!cfg) {
			logger.warn('[TakService] No configuration found');
			return null;
		}
		if (!cfg.certPath || !cfg.keyPath) {
			logger.warn('[TakService] TLS certificates not configured');
			return null;
		}
		// TS can't widen the field-level narrowing back into the object type, so this
		// assertion just expresses what the early-returns above already enforce.
		return cfg as ValidatedTakConfig;
	}

	/** Load TLS certificate files from disk */
	private async loadCertificates(
		config: ValidatedTakConfig
	): Promise<{ cert: string; key: string; ca?: string } | null> {
		try {
			const cert = await readFile(config.certPath, 'utf-8');
			const key = await readFile(config.keyPath, 'utf-8');
			const ca = config.caPath ? await readFile(config.caPath, 'utf-8') : undefined;
			return { cert, key, ca };
		} catch (err) {
			logger.error('[TakService] Failed to load certificates', { error: String(err) });
			broadcastTakStatus(
				this.broadcastState(),
				'error',
				err instanceof Error ? err.message : 'Certificate load failed'
			);
			return null;
		}
	}

	/** Establish the TAK TLS connection */
	private async establishConnection(
		config: ValidatedTakConfig,
		certs: { cert: string; key: string; ca?: string }
	): Promise<void> {
		const url = new URL(`ssl://${config.hostname}:${config.port}`);
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
		broadcastTakStatus(
			this.broadcastState(),
			'error',
			err instanceof Error ? err.message : 'Connection failed'
		);
		if (this.shouldConnect) this.scheduleReconnect();
	}

	public async connect() {
		const validated = this.validateTlsConfig();
		if (!validated) return;
		this.destroyExisting();

		const certs = await this.loadCertificates(validated);
		if (!certs) return;

		try {
			await this.establishConnection(validated, certs);
		} catch (err) {
			this.handleConnectError(err);
		}
	}

	private setupEventHandlers() {
		if (!this.tak) return;

		this.tak.on('secureConnect', () => {
			logger.info('[TakService] Securely connected');
			this.connectedAt = Date.now();
			this.lastActivityAt = Date.now();
			this.emit('status', 'connected');
			broadcastTakStatus(this.broadcastState(), 'connected');
			this.saBroadcaster.start();
		});

		this.tak.on('cot', (cot: CoT) => {
			this.messageCount++;
			this.lastActivityAt = Date.now();
			this.emit('cot', cot);
			broadcastTakCot(CoTParser.to_xml(cot));
		});

		this.tak.on('end', () => {
			logger.info('[TakService] Connection ended');
			this.saBroadcaster.stop();
			this.connectedAt = null;
			this.lastActivityAt = null;
			this.emit('status', 'disconnected');
			broadcastTakStatus(this.broadcastState(), 'disconnected');
			if (this.shouldConnect) this.scheduleReconnect();
		});

		this.tak.on('timeout', () => logger.warn('[TakService] Connection timeout'));

		this.tak.on('error', (err: Error) => {
			logger.error('[TakService] TAK socket error', { error: err.message });
			// We don't use this.emit('error', err) because Node.js crashes on unhandled 'error' events
			this.emit('tak-socket-error', err);
			this.saBroadcaster.stop();
			broadcastTakStatus(this.broadcastState(), 'error', err.message);

			this.connectedAt = null;
			this.lastActivityAt = null;
			if (this.shouldConnect) this.scheduleReconnect();
		});

		this.tak.on('ping', () => {
			this.lastActivityAt = Date.now();
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
		this.saBroadcaster.stop();
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
		broadcastTakStatus(this.broadcastState(), 'disconnected');
	}

	/** Send immediately and reset throttle entry */
	private sendImmediate(uid: string, cot: CoT, entry: ThrottleEntry | undefined): void {
		if (entry?.pendingTimeout) clearTimeout(entry.pendingTimeout);
		this.throttleMap.set(uid, { lastSent: Date.now(), pendingTimeout: null, pendingCot: null });
		if (!this.tak) return;
		this.tak.write([cot]);
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

	/** Route a uid'd CoT to immediate-send or deferred-send based on throttle state. */
	private dispatchThrottledCot(uid: string, cot: CoT): void {
		const now = Date.now();
		const entry = this.throttleMap.get(uid);
		if (!entry) {
			this.sendImmediate(uid, cot, undefined);
			return;
		}
		if (now - entry.lastSent >= COT_THROTTLE_MS) {
			this.sendImmediate(uid, cot, entry);
			return;
		}
		this.scheduleDeferredSend(entry, cot, now);
	}

	/** Sends a CoT message, throttled to max 1 update/sec per entity UID. */
	public sendCot(cot: CoT) {
		if (!this.tak?.open) return;
		const uid = cot.uid();
		if (!uid) {
			this.tak.write([cot]);
			return;
		}
		this.dispatchThrottledCot(uid, cot);
	}

	public async saveConfig(config: TakServerConfig) {
		saveTakConfig(this.db.rawDb, config);
		this.config = config;
		if (this.shouldConnect) await this.connect();
	}

	/** Snapshot current state for broadcast functions */
	private broadcastState() {
		return {
			config: this.config,
			connectedAt: this.connectedAt,
			messageCount: this.messageCount,
			saBroadcast: this.saBroadcaster.getStatus()
		};
	}
}
