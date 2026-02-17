/* eslint-disable no-console */
import { EventEmitter } from 'events';
import * as net from 'net';
import * as tls from 'tls';

import type { CotMessage, TakServerConfig } from '../../types/tak';

/** Authentication failure (bad cert, wrong password, rejected by server) */
export class TakAuthError extends Error {
	readonly code = 'TAK_AUTH_ERROR';
	constructor(
		message: string,
		public readonly cause?: Error
	) {
		super(message);
		this.name = 'TakAuthError';
	}
}

/** Connection failure (network unreachable, timeout, server down) */
export class TakConnectionError extends Error {
	readonly code = 'TAK_CONNECTION_ERROR';
	constructor(
		message: string,
		public readonly cause?: Error
	) {
		super(message);
		this.name = 'TakConnectionError';
	}
}

const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export class TakClient extends EventEmitter {
	private client: net.Socket | tls.TLSSocket | null = null;
	private config: TakServerConfig;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private isConnected = false;
	private reconnectAttempt = 0;
	private intentionalDisconnect = false;

	// Cached credentials for automatic reconnection
	private cachedKey?: Buffer;
	private cachedCert?: Buffer;
	private cachedCa?: Buffer;

	constructor(config: TakServerConfig) {
		super();
		this.config = config;
	}

	public async connect(key?: Buffer, cert?: Buffer, ca?: Buffer) {
		if (this.isConnected) return;

		// Cache credentials for reconnection
		if (key) this.cachedKey = key;
		if (cert) this.cachedCert = cert;
		if (ca) this.cachedCa = ca;

		this.intentionalDisconnect = false;

		console.log(`[TAK] Connecting to ${this.config.hostname}:${this.config.port}...`);

		if (this.config.protocol === 'tls') {
			if (!this.cachedKey || !this.cachedCert) {
				const err = new TakAuthError('TLS connections require client certificate and key');
				this.emit('error', err);
				return;
			}

			const options: tls.ConnectionOptions = {
				host: this.config.hostname,
				port: this.config.port,
				key: this.cachedKey,
				cert: this.cachedCert,
				// FR-012: Insecure TLS MUST NOT be supported.
				rejectUnauthorized: true,
				...(this.cachedCa ? { ca: this.cachedCa } : {})
			};

			this.client = tls.connect(options);
		} else {
			this.client = net.createConnection(this.config.port, this.config.hostname);
		}

		this.client.on('connect', () => {
			console.log('[TAK] Connected');
			this.isConnected = true;
			this.reconnectAttempt = 0;
			this.emit('connect');
		});

		this.client.on('secureConnect', () => {
			console.log('[TAK] Securely Connected');
			this.isConnected = true;
			this.reconnectAttempt = 0;
			this.emit('connect');
		});

		this.client.on('data', (data) => {
			this.handleData(data);
		});

		this.client.on('error', (err) => {
			console.error('[TAK] Error:', err.message);

			// Classify the error
			const isAuthError =
				err.message.includes('certificate') ||
				err.message.includes('handshake') ||
				err.message.includes('CERT_') ||
				err.message.includes('ERR_TLS');

			const classified = isAuthError
				? new TakAuthError(err.message, err)
				: new TakConnectionError(err.message, err);

			this.emit('error', classified);
		});

		this.client.on('close', () => {
			console.log('[TAK] Connection closed');
			this.isConnected = false;
			this.client = null;
			this.emit('disconnect');

			if (!this.intentionalDisconnect) {
				this.scheduleReconnect();
			}
		});
	}

	public disconnect() {
		this.intentionalDisconnect = true;
		if (this.client) {
			this.client.destroy();
			this.client = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.isConnected = false;
		this.reconnectAttempt = 0;
	}

	private scheduleReconnect() {
		if (this.reconnectTimeout || this.intentionalDisconnect) return;

		// Exponential backoff with jitter: min(base * 2^attempt + jitter, max)
		const expDelay = BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt);
		const jitter = Math.random() * BASE_RECONNECT_DELAY;
		const delay = Math.min(expDelay + jitter, MAX_RECONNECT_DELAY);

		this.reconnectAttempt++;
		console.log(
			`[TAK] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`
		);

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			this.connect().catch((err) => {
				console.error('[TAK] Reconnect failed:', err);
			});
		}, delay);
	}

	public send(cot: CotMessage | string) {
		if (!this.client || !this.isConnected) return;

		let xml = '';
		if (typeof cot === 'string') {
			xml = cot;
		} else if (cot.event) {
			const e = cot.event;
			const d = e.detail || {};
			const contact = d.contact;
			const remarks = d.remarks;

			xml = `<event version="2.0" uid="${e.uid}" type="${e.type}" time="${e.time}" start="${e.start}" stale="${e.stale}" how="${e.how}">
<point lat="${e.point.lat}" lon="${e.point.lon}" hae="${e.point.hae}" ce="${e.point.ce}" le="${e.point.le}"/>
<detail>
<contact callsign="${contact?.callsign || 'Unknown'}"/>
${remarks ? `<remarks>${remarks}</remarks>` : ''}
</detail>
</event>`;
		} else {
			console.warn('[TakClient] Invalid CoT object format');
			return;
		}

		this.client.write(xml);
	}

	private handleData(data: Buffer) {
		const str = data.toString();
		this.emit('cot', str);
	}
}
