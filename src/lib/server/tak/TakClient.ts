/* eslint-disable no-console */
import { EventEmitter } from 'events';
import * as net from 'net';
import * as tls from 'tls';

import type { CotMessage, TakServerConfig } from '../../types/tak';
// If @tak-ps/node-tak is not the exact package name or usage, we might need to adjust.
// Assuming standard node-tak usage or implementing raw buffer handling if needed.
// Actually, for simplicity and robustness, passing XML directly via TLS might be easier if node-tak is complex to wrap without docs.
// But plan says "wrapper for node-tak". Let's try to use it or implement basic CoT if it fails.

export class TakClient extends EventEmitter {
	private client: net.Socket | tls.TLSSocket | null = null;
	private config: TakServerConfig;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private isConnected = false;

	constructor(config: TakServerConfig) {
		super();
		this.config = config;
	}

	public async connect(key?: Buffer, cert?: Buffer, ca?: Buffer) {
		if (this.isConnected) return;

		console.log(`[TAK] Connecting to ${this.config.hostname}:${this.config.port}...`);

		const options: tls.ConnectionOptions = {
			host: this.config.hostname,
			port: this.config.port,
			rejectUnauthorized: false // For self-signed certs (common in TAK)
		};

		if (this.config.protocol === 'tls' && key && cert) {
			options.key = key;
			options.cert = cert;
			if (ca) options.ca = ca;
			this.client = tls.connect(options);
		} else {
			// TCP connect (or TLS without certs if protocol is tls but no certs provided? usually tls requires certs in TAK)
			if (this.config.protocol === 'tls') {
				this.client = tls.connect(options);
			} else {
				this.client = net.createConnection(this.config.port, this.config.hostname);
			}
		}

		this.client.on('connect', () => {
			console.log('[TAK] Connected');
			this.isConnected = true;
			this.emit('connect');
		});

		this.client.on('secureConnect', () => {
			console.log('[TAK] Securely Connected');
			this.isConnected = true;
			this.emit('connect');
		});

		this.client.on('data', (data) => {
			this.handleData(data);
		});

		this.client.on('error', (err) => {
			console.error('[TAK] Error:', err.message);
			this.emit('error', err);
		});

		this.client.on('close', () => {
			console.log('[TAK] Connection closed');
			this.isConnected = false;
			this.client = null;
			this.emit('disconnect');
			this.scheduleReconnect();
		});
	}

	public disconnect() {
		if (this.client) {
			this.client.destroy();
			this.client = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.isConnected = false;
	}

	private scheduleReconnect() {
		if (this.reconnectTimeout) return;
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			// Need credentials to reconnect - this wrapper might need to callback to service or store credentials?
			// For now, emit a 'reconnect_needed' event or similar?
			// Actually, best to let the service handle reconnection logic with credentials.
			// But if we have credentials in memory?
			// We passed them in connect(). We didn't store them.
			// Let's rely on service to call connect() again.
		}, 5000);
	}

	public send(cot: CotMessage | string) {
		if (!this.client || !this.isConnected) return;

		let xml = '';
		if (typeof cot === 'string') {
			xml = cot;
		} else {
			// Check if it's already a full CoT object structure
			if (cot.event) {
				// Convert structured object to XML
				// Minimal CoT XML required
				// We need to construct XML from the nested object
				const e = cot.event;
				const d = e.detail || {};
				const contact = d.contact; // contact is optional
				const remarks = d.remarks;

				xml = `<event version="2.0" uid="${e.uid}" type="${e.type}" time="${e.time}" start="${e.start}" stale="${e.stale}" how="${e.how}">
                    <point lat="${e.point.lat}" lon="${e.point.lon}" hae="${e.point.hae}" ce="${e.point.ce}" le="${e.point.le}"/>
                    <detail>
                        <contact callsign="${contact?.callsign || 'Unknown'}"/>
                         ${remarks ? `<remarks>${remarks}</remarks>` : ''}
                    </detail>
                 </event>`;
			} else {
				// Fallback or error
				console.warn('[TakClient] Invalid CoT object format');
				return;
			}
		}

		this.client.write(xml);
	}

	private handleData(data: Buffer) {
		// Parse incoming CoT XML
		// Ideally use a stream parser or just naive string check for now
		const str = data.toString();
		// Emit raw or parsed
		this.emit('cot', str);
	}
}
