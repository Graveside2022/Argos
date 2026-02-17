/* eslint-disable no-console */
import { EventEmitter } from 'events';

import type { CotMessage, TakServerConfig } from '../../types/tak';
import { RFDatabase } from '../db/database';
import { TakClient } from './TakClient';

const COT_THROTTLE_MS = 1000; // Max 1 update/sec per entity

interface ThrottleEntry {
	lastSent: number;
	pendingTimeout: NodeJS.Timeout | null;
	pendingCot: CotMessage | string | null;
}

export class TakService extends EventEmitter {
	private static instance: TakService;
	private client: TakClient | null = null;
	private config: TakServerConfig | null = null;
	private db: RFDatabase;
	private shouldConnect = false;
	private throttleMap = new Map<string, ThrottleEntry>();

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

	/**
	 * Initializes the service by loading config from DB and connecting if enabled.
	 */
	public async initialize() {
		console.log('[TakService] Initializing...');
		await this.loadConfig();
		if (this.config && this.config.connectOnStartup) {
			this.shouldConnect = true;
			await this.connect();
		}
	}

	private async loadConfig() {
		// Load from DB
		const stmt = this.db.rawDb.prepare('SELECT * FROM tak_configs LIMIT 1');
		const row = stmt.get() as TakServerConfig;
		if (row) {
			this.config = row;
		}
	}

	public async connect() {
		if (!this.config) {
			console.warn('[TakService] No configuration found.');
			return;
		}

		if (this.client) {
			this.client.disconnect();
		}

		this.client = new TakClient(this.config);

		// Load certs if needed
		let key: Buffer | undefined;
		let cert: Buffer | undefined;
		let ca: Buffer | undefined;

		if (this.config.protocol === 'tls' && this.config.keyPath && this.config.certPath) {
			try {
				// We need to read the extracted key/cert files.
				// CertManager saves them. Use fs to read?
				// CertManager deals with paths.
				// Let's assume absolute paths or relative to cwd.
				const fs = await import('fs/promises');
				key = await fs.readFile(this.config.keyPath);
				cert = await fs.readFile(this.config.certPath);
				if (this.config.caPath) {
					ca = await fs.readFile(this.config.caPath);
				}
			} catch (err) {
				console.error('[TakService] Failed to load certificates:', err);
				return;
			}
		}

		this.client.on('connect', () => {
			this.emit('status', 'connected');
			import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
				WebSocketManager.getInstance().broadcast({
					type: 'tak_status',
					data: { status: 'connected' },
					timestamp: new Date().toISOString()
				});
			});
		});

		this.client.on('disconnect', () => {
			this.emit('status', 'disconnected');
			import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
				WebSocketManager.getInstance().broadcast({
					type: 'tak_status',
					data: { status: 'disconnected' },
					timestamp: new Date().toISOString()
				});
			});
			if (this.shouldConnect) {
				// Client handles reconnect schedule usually, or we do it here
			}
		});

		this.client.on('cot', (xml: string) => {
			this.emit('cot', xml);
			// Broadcast to frontend
			import('../kismet/web-socket-manager').then(({ WebSocketManager }) => {
				// Broadcast CoT message to WebSocket clients
				WebSocketManager.getInstance().broadcast({
					type: 'tak_cot',
					data: { xml }, // Wrap string in object to match Record<string, unknown>
					timestamp: new Date().toISOString()
				});
			});
		});

		this.client.on('error', (err) => {
			this.emit('error', err);
		});

		await this.client.connect(key, cert, ca);
	}

	public disconnect() {
		this.shouldConnect = false;
		if (this.client) {
			this.client.disconnect();
		}
		// Clear all pending throttle timers
		for (const entry of this.throttleMap.values()) {
			if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
		}
		this.throttleMap.clear();
		this.emit('status', 'disconnected');
	}

	/**
	 * Sends a CoT message, throttled to max 1 update/sec per entity UID.
	 * If multiple updates arrive within the window, only the latest is sent.
	 */
	public sendCot(cot: CotMessage | string) {
		if (!this.client) return;

		const uid = this.extractUid(cot);
		if (!uid) {
			// No UID to throttle on — send immediately
			this.client.send(cot);
			return;
		}

		const now = Date.now();
		const entry = this.throttleMap.get(uid);

		if (!entry || now - entry.lastSent >= COT_THROTTLE_MS) {
			// Enough time has passed — send immediately
			if (entry?.pendingTimeout) clearTimeout(entry.pendingTimeout);
			this.throttleMap.set(uid, { lastSent: now, pendingTimeout: null, pendingCot: null });
			this.client.send(cot);
		} else {
			// Within throttle window — schedule latest for when window expires
			if (entry.pendingTimeout) clearTimeout(entry.pendingTimeout);
			const delay = COT_THROTTLE_MS - (now - entry.lastSent);
			entry.pendingCot = cot;
			entry.pendingTimeout = setTimeout(() => {
				if (this.client && entry.pendingCot) {
					this.client.send(entry.pendingCot);
					entry.lastSent = Date.now();
					entry.pendingCot = null;
					entry.pendingTimeout = null;
				}
			}, delay);
		}
	}

	private extractUid(cot: CotMessage | string): string | null {
		if (typeof cot === 'string') {
			const match = cot.match(/uid="([^"]+)"/);
			return match ? match[1] : null;
		}
		return cot.event?.uid ?? null;
	}

	public async saveConfig(config: TakServerConfig) {
		// Update DB
		// Check if exists
		const existing = this.db.rawDb
			.prepare('SELECT id FROM tak_configs WHERE id = ?')
			.get(config.id);

		if (existing) {
			const stmt = this.db.rawDb.prepare(`
                UPDATE tak_configs SET 
                    name = @name, hostname = @hostname, port = @port, protocol = @protocol,
                    certPath = @certPath, keyPath = @keyPath, caPath = @caPath,
                    connectOnStartup = @connectOnStartup
                WHERE id = @id
             `);
			stmt.run(config);
		} else {
			const stmt = this.db.rawDb.prepare(`
                INSERT INTO tak_configs (
                    id, name, hostname, port, protocol, certPath, keyPath, caPath, connectOnStartup
                ) VALUES (
                    @id, @name, @hostname, @port, @protocol, @certPath, @keyPath, @caPath, @connectOnStartup
                )
             `);
			stmt.run(config);
		}

		this.config = config;

		// Reconnect if active
		if (this.shouldConnect) {
			await this.connect();
		}
	}
}
