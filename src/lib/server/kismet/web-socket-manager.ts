// WebSocket management for Kismet real-time data
//
// Security note (Phase 2.1.6): This class does NOT create a WebSocket server.
// It manages clients that are handed in via addClient() after the WS server in
// hooks.server.ts has already authenticated the connection (verifyClient equivalent
// + maxPayload: 262144 on the noServer WSS). No duplicate auth check is needed here
// because the connection is rejected at the server level before it reaches addClient().
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

import { logError, logInfo } from '$lib/utils/logger';

import type { PollerState } from './kismet-poller';
import { pollKismetDevices } from './kismet-poller';
import type { KismetDevice, WebSocketMessage } from './types';

// Client message interface
interface ClientMessage {
	type: string;
	events?: string[];
	filters?: {
		minSignal?: number;
		deviceTypes?: string[];
	};
}

interface Subscription {
	types: Set<string>;
	filters?: {
		minSignal?: number;
		deviceTypes?: string[];
	};
}

export class WebSocketManager extends EventEmitter {
	private static instance: WebSocketManager;
	private clients = new Map<WebSocket, Subscription>();
	private pollingInterval?: ReturnType<typeof setInterval>;
	private cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

	// Configuration
	private readonly POLL_INTERVAL = 2000;
	private readonly THROTTLE_INTERVAL = 500;
	private readonly CACHE_EXPIRY = 300000; // 5 minutes
	private readonly KISMET_API_URL = process.env.KISMET_API_URL || 'http://localhost:2501';
	private readonly KISMET_API_KEY = process.env.KISMET_API_KEY || '';

	// Polling state — shared with kismet-poller module
	private pollerState: PollerState = {
		deviceCache: new Map(),
		updateThrottles: new Map(),
		lastPollTime: 0,
		isPolling: false,
		statsThrottle: 0
	};

	private constructor() {
		super();
		this.startPolling();
		this.cacheCleanupInterval = setInterval(() => this.cleanupCache(), 60000);
	}

	/**
	 * Get singleton instance — persisted via globalThis to survive Vite HMR
	 * reloads. Without this, each HMR re-evaluation creates a new singleton
	 * with a new 60s cache cleanup interval, orphaning the old instance.
	 */
	private static readonly INSTANCE_KEY = '__argos_wsManager';
	static getInstance(): WebSocketManager {
		// Safe: globalThis typed as Record for HMR singleton persistence
		const existing = (globalThis as Record<string, unknown>)[WebSocketManager.INSTANCE_KEY] as
			| WebSocketManager
			| undefined;
		if (existing) {
			this.instance = existing;
			return existing;
		}
		if (!this.instance) {
			this.instance = new WebSocketManager();
			// Safe: globalThis typed as Record for HMR singleton assignment
			(globalThis as Record<string, unknown>)[WebSocketManager.INSTANCE_KEY] = this.instance;
		}
		return this.instance;
	}

	/** Start polling Kismet API */
	private startPolling() {
		if (this.pollingInterval) clearInterval(this.pollingInterval);
		void this.poll();
		this.pollingInterval = setInterval(() => void this.poll(), this.POLL_INTERVAL);
	}

	/** Delegate polling to the kismet-poller module */
	private async poll() {
		await pollKismetDevices(
			this.pollerState,
			this.clients.size,
			this.KISMET_API_URL,
			this.KISMET_API_KEY,
			this.THROTTLE_INTERVAL,
			(message, filter) => this.broadcast(message, filter)
		);
	}

	/** Add a client WebSocket with subscription preferences */
	addClient(ws: WebSocket, subscription?: Partial<Subscription>) {
		const sub: Subscription = {
			types: new Set(subscription?.types || ['device_update', 'status_change', 'alert']),
			filters: subscription?.filters
		};

		this.clients.set(ws, sub);

		ws.on('close', () => {
			this.clients.delete(ws);
			logInfo(`Client disconnected. Total clients: ${this.clients.size}`);
		});

		ws.on('error', (error) => {
			logError('Client WebSocket error:', { error });
			this.clients.delete(ws);
		});

		ws.on('message', (data: Buffer) => {
			try {
				// Safe: WebSocket message parsed as ClientMessage — validated by handler below
				const message = JSON.parse(data.toString()) as ClientMessage;
				this.handleClientMessage(ws, message);
			} catch (error) {
				logError('Error parsing client message:', { error });
			}
		});

		// Send initial status
		const statusMessage: WebSocketMessage = {
			type: 'status_change',
			data: {
				connected: true,
				polling_active: !!this.pollingInterval,
				clients_connected: this.clients.size,
				devices_cached: this.pollerState.deviceCache.size
			},
			timestamp: new Date().toISOString()
		};

		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(statusMessage));
		}

		if (sub.types.has('device_update') || sub.types.has('*')) {
			this.sendCachedDevices(ws, sub);
		}

		logInfo(`Client connected. Total clients: ${this.clients.size}`);
	}

	/** Handle messages from clients */
	private handleClientMessage(ws: WebSocket, message: ClientMessage) {
		const sub = this.clients.get(ws);
		if (!sub) return;

		switch (message.type) {
			case 'subscribe':
				if (message.events) message.events.forEach((e) => sub.types.add(e));
				break;
			case 'unsubscribe':
				if (message.events) message.events.forEach((e) => sub.types.delete(e));
				break;
			case 'set_filters':
				sub.filters = message.filters;
				break;
			case 'get_devices':
				this.sendCachedDevices(ws, sub);
				break;
			case 'ping':
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
				}
				break;
		}
	}

	/** Send cached devices to a client */
	private sendCachedDevices(ws: WebSocket, sub: Subscription) {
		const devices = this.getFilteredDevices(sub);
		const message: WebSocketMessage = {
			type: 'device_update',
			data: { devices, total: devices.length, cached: true },
			timestamp: new Date().toISOString()
		};

		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(message));
		}
	}

	/** Filter cached devices based on subscription filters */
	private getFilteredDevices(sub: Subscription): KismetDevice[] {
		return Array.from(this.pollerState.deviceCache.values())
			.map((cached) => cached.device)
			.filter((device) => {
				if (sub.filters) {
					if (
						sub.filters.minSignal &&
						device.signalStrength &&
						device.signalStrength < sub.filters.minSignal
					)
						return false;
					if (sub.filters.deviceTypes && !sub.filters.deviceTypes.includes(device.type))
						return false;
				}
				return true;
			});
	}

	/** Broadcast message to clients with optional filter */
	public broadcast(message: WebSocketMessage, filter?: (sub: Subscription) => boolean) {
		const data = JSON.stringify(message);
		this.clients.forEach((sub, client) => {
			if (client.readyState === WebSocket.OPEN) {
				if (!filter || filter(sub)) client.send(data);
			}
		});
	}

	/** Clean up stale cache entries */
	private cleanupCache() {
		const now = Date.now();
		const staleKeys: string[] = [];
		this.pollerState.deviceCache.forEach((cached, key) => {
			if (now - cached.lastUpdate > this.CACHE_EXPIRY) staleKeys.push(key);
		});
		staleKeys.forEach((key) => {
			this.pollerState.deviceCache.delete(key);
			this.pollerState.updateThrottles.delete(key);
		});
		if (staleKeys.length > 0) {
			logInfo(`Cleaned up ${staleKeys.length} stale devices from cache`);
		}
	}

	/** Get current statistics */
	getStats() {
		return {
			clients: this.clients.size,
			devices: this.pollerState.deviceCache.size,
			polling: !!this.pollingInterval,
			lastPoll: this.pollerState.lastPollTime
		};
	}

	/** Clean up resources */
	destroy() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = undefined;
		}
		if (this.cacheCleanupInterval) {
			clearInterval(this.cacheCleanupInterval);
			this.cacheCleanupInterval = null;
		}
		this.clients.forEach((_, client) => client.close());
		this.clients.clear();
		this.pollerState.deviceCache.clear();
		this.pollerState.updateThrottles.clear();
		this.removeAllListeners();
	}
}
